import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import Big from "big.js";
import { useAccount } from "./account";
import { keysToCamel } from "./utils";
import { NearConfig, noInternetMode } from "./near";

const defaultSales = {
  loading: true,
  sales: [],
};

const mapSubscription = (s) => {
  return {
    claimedOutBalance: s.claimedOutBalance.map(Big),
    spentInBalance: Big(s.spentInBalance),
    remainingInBalance: Big(s.remainingInBalance),
    unclaimedOutBalances: s.unclaimedOutBalances.map(Big),
    shares: Big(s.shares),
  };
};

export const mapSale = (s) => {
  s = keysToCamel(s);
  s.outTokens.forEach((o) => {
    o.remaining = Big(o.remaining);
    o.distributed = Big(o.distributed);
    if (o.treasuryUnclaimed) {
      o.treasuryUnclaimed = Big(o.treasuryUnclaimed);
    }
  });
  s.inTokenRemaining = Big(s.inTokenRemaining);
  s.inTokenPaidUnclaimed = Big(s.inTokenPaidUnclaimed);
  s.inTokenPaid = Big(s.inTokenPaid);
  s.totalShares = Big(s.totalShares);
  s.startTime = parseFloat(s.startTime) / 1e6;
  s.startDate = new Date(s.startTime);
  s.duration = parseFloat(s.duration) / 1e6;
  s.endDate = new Date(s.startTime + s.duration);
  s.remainingDuration = parseFloat(s.remainingDuration) / 1e6;
  s.currentDate = new Date(s.startTime + s.duration - s.remainingDuration);
  if (s.subscription) {
    s.subscription = mapSubscription(s.subscription);
  }
  return s;
};

export const useSales = singletonHook(defaultSales, () => {
  const [sales, setSales] = useState(defaultSales);
  const account = useAccount();

  useEffect(() => {
    if (!account.near) {
      return;
    }
    const fetchSale = async (saleId) => {
      return mapSale(
        await account.near.contract.get_sale({
          sale_id: saleId,
          account_id: account.accountId || undefined,
        })
      );
    };

    const fetchSales = async () => {
      const rawSales = await account.near.contract.get_sales({
        account_id: account.accountId || undefined,
      });
      return rawSales.map(mapSale);
    };
    const refreshSale = async (saleId) => {
      const sale = await fetchSale(saleId);
      setSales((prev) =>
        Object.assign({}, prev, {
          sales: Object.assign([], prev.sales, { [saleId]: sale }),
        })
      );
    };

    fetchSales()
      .then((sales) => {
        setSales((prev) => {
          return {
            loading: false,
            sales: prev.sales.concat(sales),
            fetchSale,
            refreshSale,
          };
        });
      })
      .catch(() => {
        if (noInternetMode) {
          const duration = 2 * 31 * 24 * 60 * 60 * 1000;
          const startTime = new Date().getTime() - Math.trunc(duration * 0.42);
          setSales(() => {
            return {
              loading: false,
              sales: [
                {
                  saleId: 0,
                  title: "Founding 5% $SKYWARD sale",
                  inTokenAccountId: NearConfig.wrapNearAccountId,
                  outTokens: [
                    {
                      tokenAccountId: NearConfig.skywardTokenAccountId,
                      remaining: Big("1000000000000000000000000"),
                      distributed: Big("1000000000000000000000000"),
                    },
                  ],
                  inTokenRemaining: Big("100000000000000000000000000"),
                  inTokenPaidUnclaimed: Big("100000000000000000000000000"),
                  inTokenPaid: Big("100000000000000000000000000"),
                  totalShares: Big("100000000000000000000000000"),
                  startTime,
                  startDate: new Date(startTime),
                  duration,
                  endDate: new Date(startTime + duration),
                  remainingDuration:
                    startTime + duration - new Date().getTime(),
                  currentDate: new Date(),
                  // subscription: null,
                  //     claimedOutBalance: Big(0),
                  //     spentInBalance: Big(s.spentInBalance),
                  //     remainingInBalance: Big(s.remainingInBalance),
                  //     unclaimedOutBalances: s.unclaimedOutBalances.map(Big),
                  //     shares: Big(s.shares),
                  //   };
                },
              ],
            };
          });
        }
      });
  }, [account]);

  return sales;
});
