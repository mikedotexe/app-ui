import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { NearConfig, useNear } from "./near";
import Big from "big.js";
import * as nearAPI from "near-api-js";
import { OneNear } from "./utils";

const SimplePool = "SIMPLE_POOL";

const defaultRefFinance = {
  loading: true,
  pools: {},
  nearPrice: Big(0),
  refContract: null,
};

const ot = (pool, token) =>
  token in pool.tokens ? pool.tt[1 - pool.tt.indexOf(token)] : null;

const usdTokens = {
  "6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near": Big(10).pow(
    18
  ),
  "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near": Big(10).pow(
    6
  ),
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near": Big(10).pow(
    6
  ),
};

export const useRefFinance = singletonHook(defaultRefFinance, () => {
  const [refFinance, setRefFinance] = useState(defaultRefFinance);
  const _near = useNear();

  useEffect(() => {
    _near.then(async (near) => {
      const refContract = new nearAPI.Contract(
        near.account,
        NearConfig.refContractName,
        {
          viewMethods: [
            "get_number_of_pools",
            "get_pools",
            "get_pool",
            "get_return",
            "get_deposits",
          ],
          changeMethods: [],
        }
      );

      const limit = 100;
      // Limit pools for now until we need other prices.
      const numPools = Math.min(limit, await refContract.get_number_of_pools());
      const promises = [];
      for (let i = 0; i < numPools; i += limit) {
        promises.push(refContract.get_pools({ from_index: i, limit }));
      }
      const rawPools = (await Promise.all(promises)).flat();

      const pools = {};
      rawPools.forEach((pool, i) => {
        if (pool.pool_kind === SimplePool) {
          const tt = pool.token_account_ids;
          const p = {
            index: i,
            tt,
            tokens: tt.reduce((acc, token, tokenIndex) => {
              acc[token] = Big(pool.amounts[tokenIndex]);
              return acc;
            }, {}),
            fee: pool.total_fee,
            shares: Big(pool.shares_total_supply),
          };
          pools[p.index] = p;
        }
      });

      let totalNearInUsdPools = Big(0);
      let totalUsdInUsdPools = Big(0);
      const wNEAR = NearConfig.wrapNearAccountId;

      Object.values(pools).forEach((pool) => {
        if (wNEAR in pool.tokens) {
          pool.otherToken = ot(pool, wNEAR);
          if (pool.otherToken in usdTokens) {
            totalNearInUsdPools = totalNearInUsdPools.add(pool.tokens[wNEAR]);
            totalUsdInUsdPools = totalUsdInUsdPools.add(
              pool.tokens[pool.otherToken]
                .mul(OneNear)
                .div(usdTokens[pool.otherToken])
            );
          }
        }
      });

      const nearPrice = totalNearInUsdPools.gt(0)
        ? totalUsdInUsdPools.div(totalNearInUsdPools)
        : Big(0);

      setRefFinance({
        loading: false,
        pools,
        nearPrice,
        refContract,
      });
    });
  }, [_near]);
  return refFinance;
});
