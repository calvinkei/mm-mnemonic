import logo from "./logo.svg";
import "./App.css";
import { useCallback, useEffect, useState } from "react";
import * as secp256k1 from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import { bech32 } from "bech32";
// import { keccak256 } from "ethereum-cryptography/keccak";
// import { HDKey } from "@scure/bip32";
// import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
// import { wordlist } from "@scure/bip39/wordlists/english";
// import { Buffer } from "buffer";
import { fromHex, toBase64, toHex, toUtf8 } from "@cosmjs/encoding";

function sortObject(obj) {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  // NOTE: Use forEach instead of reduce for performance with large objects eg Wasm code
  sortedKeys.forEach((key) => {
    result[key] = sortObject(obj[key]);
  });
  return result;
}

function encodeSecp256k1Pubkey(pubkey) {
  if (pubkey.length !== 33 || (pubkey[0] !== 0x02 && pubkey[0] !== 0x03)) {
    throw new Error(
      "Public key must be compressed secp256k1, i.e. 33 bytes starting with 0x02 or 0x03"
    );
  }
  return {
    type: "tendermint/PubKeySecp256k1",
    value: toBase64(pubkey),
  };
}

function encodeSecp256k1Signature(pubkey, signature) {
  if (signature.length !== 64) {
    throw new Error(
      "Signature must be 64 bytes long. Cosmos SDK uses a 2x32 byte fixed length encoding for the secp256k1 signature integers r and s."
    );
  }

  return {
    pub_key: encodeSecp256k1Pubkey(pubkey),
    signature: toBase64(signature),
  };
}

// function stripHexPrefix(input) {
//   if (input.indexOf("0x") === 0) {
//     return input.slice(2);
//   }

//   return input;
// }

function App() {
  const [address, setAddress] = useState("");
  const [publicKeyHex, setPublicKeyHex] = useState("");
  // dYdX method
  // useEffect(() => {
  //   // TODO: check if wallet supports deterministic signing
  //   window.ethereum.enable().then((addresses) => {
  //     window.ethereum
  //       .request({
  //         method: "personal_sign",
  //         params: ["some message", addresses[0]],
  //       })
  //       .then((signature) => {
  //         const buffer = Buffer.from(stripHexPrefix(signature), "hex");
  //         const rsValues = buffer.subarray(0, 64);
  //         const entropy = keccak256(rsValues);

  //         const mnemonic = entropyToMnemonic(entropy, wordlist);
  //         const seed = mnemonicToSeedSync(mnemonic);

  //         const hdkey = HDKey.fromMasterSeed(seed);
  //         const derivedHdkey = hdkey.derive("m/44'/118'/0'/0/0");

  //         if (!hdkey.privateKey) {
  //           throw new Error("null hd key");
  //         }

  //         console.log({
  //           mnemonic,
  //           privateKey: derivedHdkey.privateKey,
  //           publicKey: derivedHdkey.publicKey,
  //         });
  //       });
  //   });
  // }, []);

  // SecretJS method
  const connect = useCallback(async () => {
    const rawMsg = toUtf8("Get address");
    const msgToSign = `0x${toHex(rawMsg)}`;
    const addresses = await window.ethereum.enable();
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [msgToSign, addresses[0]],
    });
    const sig = fromHex(signature.slice(2, -2));
    let recoveryId = parseInt(signature.slice(-2), 16) - 27;

    // When a Ledger is used, this value doesn't need to be adjusted
    if (recoveryId < 0) {
      recoveryId += 27;
    }

    const eip191MessagePrefix = toUtf8("\x19Ethereum Signed Message:\n");
    const rawMsgLength = toUtf8(String(rawMsg.length));

    const publicKey = secp256k1.getPublicKey(
      keccak_256(
        new Uint8Array([...eip191MessagePrefix, ...rawMsgLength, ...rawMsg])
      ),
      sig,
      recoveryId,
      true
    );

    const address = bech32.encode(
      "umee",
      bech32.toWords(ripemd160(sha256(publicKey)))
    );
    setPublicKeyHex(toHex(publicKey));
    setAddress(address);
  }, []);

  const signTx = useCallback(async () => {
    const signDoc = {
      chain_id: "umee-1",
      account_number: "1",
      sequence: "1",
      fee: {
        amount: [{ amount: "100000", denom: "uumee" }],
        gas: "1000000",
      },
      msgs: [
        {
          type: "cosmos-sdk/MsgSend",
          value: {
            from_address: address,
            to_address: address,
            amount: [{ amount: "100000", denom: "uumee" }],
          },
        },
      ],
      memo: "",
    };
    const msgToSign = `0x${toHex(
      toUtf8(JSON.stringify(sortObject(signDoc), null, 4))
    )}`;
    const addresses = await window.ethereum.enable();
    const sigResult = await window.ethereum.request({
      method: "personal_sign",
      params: [msgToSign, addresses[0]],
    });

    // strip leading 0x and trailing recovery id
    const sig = fromHex(sigResult.slice(2, -2));

    console.log({
      signed: signDoc,
      signature: encodeSecp256k1Signature(fromHex(publicKeyHex), sig),
    });
  }, [address, publicKeyHex]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>{address || "Not Connected"}</p>
        <a className="App-link" onClick={address ? signTx : connect}>
          {address ? "Sign Tx" : "Connect"}
        </a>
      </header>
    </div>
  );
}

export default App;
