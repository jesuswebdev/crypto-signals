import React from "react";
import Box from "@crypto-signals/components/Box";

const Disclaimer = props => {
  return (
    <Box>
      <div className="content is-normal">
        <p>
          Trading of goods, real or virtual, which include virtual currencies
          (Cryptocurrencies), involves significant level of risk. Prices can
          fluctuate on any given day. Because of such price fluctuations, you
          may gain or lose value of your assets any moment. Currency may be
          subject to large swings in value and may even become worthless. You
          should carefully consider whether such trading is suitable for you in
          light of your circumstances and financial resources. We have
          highlighted some of those risks below. Traders put their trust in a
          digital, decentralized and partially anonymous system that relies on
          peer-to-peer (network in which interconnected nodes ("peers") share
          resources amongst each other without the use of a centralized
          administrative system) networking and cryptography to maintain its
          integrity. This means that there is no central bank that can take
          corrective measure to protect the value of Cryptocurrency in a crisis
          or issue more currency.
        </p>
        <p>
          Cryptocurrency trading is probably susceptible to irrational (or
          rational) bubbles or loss of confidence, which could collapse in
          demand relative to supply. For example, due to the fundamentals of the
          cryptocurrency trading system’s functioning, it is vulnerable to
          fluctuations in the level of confidence of market participants, which
          directly affects the level of demand or supply. The level of
          confidence can be affected both by purely economic factors and
          non-economic, including technological ones. Cryptocurrency
          transactions are irreversible. If you send Cryptocurrency to an
          incorrect address, or send the wrong amount, you cannot get it back.
        </p>
        <p>
          <b>
            Any opinions, news, research, analyses, prices, or other information
            contained on JJ's Crypto Signals website and any other media are
            provided as general market commentary, and do not constitute
            investment advice.
          </b>
        </p>
        <p>
          Before buying or selling Cryptocurrency, you should educate yourself
          about digital currencies. Buying and selling entails risks and could
          result in a complete loss of your funds. You should carefully
          overthink whether your financial situation and tolerance for risk is
          suitable for buying, selling or trading Cryptocurrency.
        </p>
      </div>
    </Box>
  );
};

export default Disclaimer;