import React from "react";
import Account from "../components/Account";

export default function AccountPage(props) {
  return (
    <div>
      <div className="container">
        <div className="row mb-3">
          <Account {...props} />
        </div>
      </div>
    </div>
  );
}
