import Big from "big.js";
import ls from "local-storage";
import { isValidAccountId, keysToCamel } from "./utils";
import useSWR from "swr";
import { useAccount } from "./account";
import { LsKey, NearConfig } from "./near";

const TokenExpirationDuration = 30 * 60 * 1000;

const tokens = {};

export const isTokenRegistered = async (account, tokenAccountId, accountId) => {
  const storageBalance = await account.near.account.viewFunction(
    tokenAccountId,
    "storage_balance_of",
    {
      account_id: accountId,
    }
  );
  return storageBalance && storageBalance.total !== "0";
};

// const tokenBalances = {};

const hardcodedMetadata = (token, tokenAccountId) => {
  if (!token) {
    return token;
  }
  if (tokenAccountId === NearConfig.wrapNearAccountId) {
    token.metadata.symbol = "NEAR";
    token.metadata.icon =
      "data:image/svg+xml,%3Csvg width='53' height='52' viewBox='0 0 53 52' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='26.5' cy='26' r='26' fill='%2390E9C5'%3E%3C/circle%3E%3Ccircle cx='26.5' cy='26' r='20' fill='%23111618'%3E%3C/circle%3E%3Cg clip-path='url(%23clip10)'%3E%3Cpath d='M31.9475 17.9695L28.185 23.5172C28.1314 23.5971 28.1088 23.6936 28.1213 23.7888C28.1338 23.884 28.1805 23.9715 28.2529 24.0351C28.3254 24.0986 28.4185 24.134 28.5152 24.1347C28.6118 24.1354 28.7055 24.1012 28.7787 24.0386L32.4825 20.8483C32.5042 20.829 32.5311 20.8164 32.5599 20.812C32.5887 20.8077 32.6181 20.8117 32.6446 20.8237C32.6711 20.8357 32.6936 20.8551 32.7092 20.8795C32.7248 20.9039 32.7329 20.9323 32.7325 20.9612V30.9494C32.7325 30.98 32.723 31.0098 32.7053 31.0348C32.6877 31.0599 32.6626 31.0789 32.6337 31.0893C32.6048 31.0998 32.5733 31.1011 32.5436 31.0932C32.5138 31.0852 32.4873 31.0684 32.4675 31.045L21.2725 17.7361C21.0924 17.525 20.8682 17.3553 20.6154 17.2389C20.3627 17.1225 20.0874 17.0621 19.8088 17.0621H19.4175C18.9089 17.0621 18.4212 17.2627 18.0616 17.6198C17.702 17.9769 17.5 18.4613 17.5 18.9663V33.0337C17.5 33.5387 17.702 34.0231 18.0616 34.3802C18.4212 34.7373 18.9089 34.9379 19.4175 34.9379V34.9379C19.7454 34.938 20.0678 34.8547 20.3541 34.6958C20.6403 34.5369 20.8808 34.3079 21.0525 34.0305L24.815 28.4828C24.8686 28.4029 24.8912 28.3064 24.8787 28.2112C24.8662 28.116 24.8195 28.0285 24.7471 27.965C24.6746 27.9014 24.5815 27.866 24.4848 27.8653C24.3882 27.8647 24.2945 27.8988 24.2212 27.9614L20.5175 31.1517C20.4958 31.171 20.4689 31.1836 20.4401 31.188C20.4113 31.1923 20.3819 31.1883 20.3554 31.1763C20.3289 31.1643 20.3064 31.1449 20.2908 31.1205C20.2752 31.0961 20.2671 31.0677 20.2675 31.0388V21.0481C20.2675 21.0176 20.277 20.9877 20.2947 20.9627C20.3123 20.9377 20.3374 20.9186 20.3663 20.9082C20.3952 20.8977 20.4267 20.8964 20.4564 20.9043C20.4862 20.9123 20.5127 20.9291 20.5325 20.9526L31.7262 34.2639C31.9063 34.475 32.1305 34.6447 32.3833 34.7611C32.6361 34.8775 32.9114 34.9379 33.19 34.9379H33.5812C33.8332 34.9381 34.0826 34.889 34.3154 34.7933C34.5482 34.6977 34.7597 34.5575 34.9379 34.3806C35.1161 34.2038 35.2575 33.9938 35.3539 33.7627C35.4504 33.5316 35.5 33.2838 35.5 33.0337V18.9663C35.5 18.4613 35.298 17.9769 34.9384 17.6198C34.5788 17.2627 34.0911 17.0621 33.5825 17.0621C33.2546 17.062 32.9322 17.1454 32.6459 17.3042C32.3597 17.4631 32.1192 17.6921 31.9475 17.9695V17.9695Z' fill='white'%3E%3C/path%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip10'%3E%3Crect width='18' height='18' fill='white' transform='translate(17.5 17)'%3E%3C/rect%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E%0A";
  }
  return token;
};

export const getTokenFetcher = async (_key, tokenAccountId, account) => {
  if (!isValidAccountId(tokenAccountId)) {
    return {
      invalidAccount: true,
    };
  }
  if (tokenAccountId in tokens) {
    return tokens[tokenAccountId];
  }
  const lsKey = LsKey + "tokens:" + tokenAccountId;
  const localToken = ls.get(lsKey);
  const time = new Date().getTime();

  if (!account) {
    return null;
  }

  const contract = {
    balanceOf: async (account, accountId) => {
      return Big(
        await account.near.account.viewFunction(
          tokenAccountId,
          "ft_balance_of",
          {
            account_id: accountId,
          }
        )
      );
    },
    isRegistered: async (account, accountId) =>
      isTokenRegistered(account, tokenAccountId, accountId),
  };

  if (localToken && localToken.expires > time) {
    const token = Object.assign({}, localToken.data, { contract });
    token.totalSupply = Big(token.totalSupply);

    return (tokens[tokenAccountId] = hardcodedMetadata(token, tokenAccountId));
  }
  let token = false;
  try {
    let [metadata, totalSupply] = await Promise.all([
      account.near.account.viewFunction(tokenAccountId, "ft_metadata"),
      account.near.account.viewFunction(tokenAccountId, "ft_total_supply"),
    ]);
    token = hardcodedMetadata(
      {
        contract,
        metadata: keysToCamel(metadata),
        totalSupply: Big(totalSupply),
      },
      tokenAccountId
    );
  } catch (e) {
    const errString = e.message.toString();
    if (errString.indexOf("does not exist while viewing") < 0) {
      console.error(e);
      return false;
    }
    token = {
      notFound: true,
    };
    return (tokens[tokenAccountId] = token);
  }
  ls.set(lsKey, {
    expires: time + TokenExpirationDuration,
    data: Object.assign({}, token, {
      totalSupply: token.totalSupply.toFixed(0),
    }),
  });
  return (tokens[tokenAccountId] = token);
};

export const useToken = (tokenAccountId) => {
  const { data: token } = useSWR(
    ["token_account_id", tokenAccountId, useAccount()],
    getTokenFetcher
  );
  return token;
};
