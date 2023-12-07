import logo from "./logo.svg";
import "./App.css";
import { useEffect } from "react";
import { keccak256 } from "ethereum-cryptography/keccak";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { Buffer } from "buffer";

function stripHexPrefix(input) {
  if (input.indexOf("0x") === 0) {
    return input.slice(2);
  }

  return input;
}

function App() {
  useEffect(() => {
    // TODO: check if wallet supports deterministic signing
    window.ethereum.enable().then((addresses) => {
      window.ethereum
        .request({
          method: "personal_sign",
          params: ["some message", addresses[0]],
        })
        .then((signature) => {
          const buffer = Buffer.from(stripHexPrefix(signature), "hex");
          const rsValues = buffer.subarray(0, 64);
          const entropy = keccak256(rsValues);

          const mnemonic = entropyToMnemonic(entropy, wordlist);
          const seed = mnemonicToSeedSync(mnemonic);

          const hdkey = HDKey.fromMasterSeed(seed);
          const derivedHdkey = hdkey.derive("m/44'/118'/0'/0/0");

          if (!hdkey.privateKey) {
            throw new Error("null hd key");
          }

          console.log({
            mnemonic,
            privateKey: derivedHdkey.privateKey,
            publicKey: derivedHdkey.publicKey,
          });
        });
    });
  }, []);
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
