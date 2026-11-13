export interface heartBeatC2S {
    sign: number;
  }
  
  export function encodeheartBeatC2S(message: heartBeatC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodeheartBeatC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeheartBeatC2S(message: heartBeatC2S, bb: ByteBuffer): void {
    // required int32 sign = 1;
    let $sign = message.sign;
    if ($sign !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($sign));
    }
  }
  
  export function decodeheartBeatC2S(binary: Uint8Array): heartBeatC2S {
    return _decodeheartBeatC2S(wrapByteBuffer(binary));
  }
  
  function _decodeheartBeatC2S(bb: ByteBuffer): heartBeatC2S {
    let message: heartBeatC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 sign = 1;
        case 1: {
          message.sign = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.sign === undefined)
      throw new Error("Missing required field: sign");
  
    return message;
  }
  
  export interface heartBeatS2C {
    sign: number;
  }
  
  export function encodeheartBeatS2C(message: heartBeatS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeheartBeatS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeheartBeatS2C(message: heartBeatS2C, bb: ByteBuffer): void {
    // required int32 sign = 1;
    let $sign = message.sign;
    if ($sign !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($sign));
    }
  }
  
  export function decodeheartBeatS2C(binary: Uint8Array): heartBeatS2C {
    return _decodeheartBeatS2C(wrapByteBuffer(binary));
  }
  
  function _decodeheartBeatS2C(bb: ByteBuffer): heartBeatS2C {
    let message: heartBeatS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 sign = 1;
        case 1: {
          message.sign = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.sign === undefined)
      throw new Error("Missing required field: sign");
  
    return message;
  }
  
  export interface webPackage {
    id: number;
    data: Uint8Array;
  }
  
  export function encodewebPackage(message: webPackage): Uint8Array {
    let bb = popByteBuffer();
    _encodewebPackage(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodewebPackage(message: webPackage, bb: ByteBuffer): void {
    // required uint32 id = 1;
    let $id = message.id;
    if ($id !== undefined) {
      writeVarint32(bb, 8);
      writeVarint32(bb, $id);
    }
  
    // required bytes data = 2;
    let $data = message.data;
    if ($data !== undefined) {
      writeVarint32(bb, 18);
      writeVarint32(bb, $data.length), writeBytes(bb, $data);
    }
  }
  
  export function decodewebPackage(binary: Uint8Array): webPackage {
    return _decodewebPackage(wrapByteBuffer(binary));
  }
  
  function _decodewebPackage(bb: ByteBuffer): webPackage {
    let message: webPackage = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required uint32 id = 1;
        case 1: {
          message.id = readVarint32(bb) >>> 0;
          break;
        }
  
        // required bytes data = 2;
        case 2: {
          message.data = readBytes(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.id === undefined)
      throw new Error("Missing required field: id");
  
    if (message.data === undefined)
      throw new Error("Missing required field: data");
  
    return message;
  }
  
  export interface loginC2S {
    mType: number;
    mAgentID: number;
    mAccount: string;
    mPassWord: string;
    mNickName: string;
    mTimeStamp: number;
    mMac: string;
    mAddress?: string;
    mIp?: string;
    advertisingId?: string;
    coinType?: number;
  }
  
  export function encodeloginC2S(message: loginC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodeloginC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeloginC2S(message: loginC2S, bb: ByteBuffer): void {
    // required int32 mType = 1;
    let $mType = message.mType;
    if ($mType !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mType));
    }
  
    // required int32 mAgentID = 2;
    let $mAgentID = message.mAgentID;
    if ($mAgentID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mAgentID));
    }
  
    // required string mAccount = 3;
    let $mAccount = message.mAccount;
    if ($mAccount !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mAccount);
    }
  
    // required string mPassWord = 4;
    let $mPassWord = message.mPassWord;
    if ($mPassWord !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mPassWord);
    }
  
    // required string mNickName = 5;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 42);
      writeString(bb, $mNickName);
    }
  
    // required int32 mTimeStamp = 6;
    let $mTimeStamp = message.mTimeStamp;
    if ($mTimeStamp !== undefined) {
      writeVarint32(bb, 48);
      writeVarint64(bb, intToLong($mTimeStamp));
    }
  
    // required string mMac = 7;
    let $mMac = message.mMac;
    if ($mMac !== undefined) {
      writeVarint32(bb, 58);
      writeString(bb, $mMac);
    }
  
    // optional string mAddress = 8;
    let $mAddress = message.mAddress;
    if ($mAddress !== undefined) {
      writeVarint32(bb, 66);
      writeString(bb, $mAddress);
    }
  
    // optional string mIp = 9;
    let $mIp = message.mIp;
    if ($mIp !== undefined) {
      writeVarint32(bb, 74);
      writeString(bb, $mIp);
    }
  
    // optional string advertisingId = 10;
    let $advertisingId = message.advertisingId;
    if ($advertisingId !== undefined) {
      writeVarint32(bb, 82);
      writeString(bb, $advertisingId);
    }
  
    // optional int32 coinType = 11;
    let $coinType = message.coinType;
    if ($coinType !== undefined) {
      writeVarint32(bb, 88);
      writeVarint64(bb, intToLong($coinType));
    }
  }
  
  export function decodeloginC2S(binary: Uint8Array): loginC2S {
    return _decodeloginC2S(wrapByteBuffer(binary));
  }
  
  function _decodeloginC2S(bb: ByteBuffer): loginC2S {
    let message: loginC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mType = 1;
        case 1: {
          message.mType = readVarint32(bb);
          break;
        }
  
        // required int32 mAgentID = 2;
        case 2: {
          message.mAgentID = readVarint32(bb);
          break;
        }
  
        // required string mAccount = 3;
        case 3: {
          message.mAccount = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mPassWord = 4;
        case 4: {
          message.mPassWord = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mNickName = 5;
        case 5: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mTimeStamp = 6;
        case 6: {
          message.mTimeStamp = readVarint32(bb);
          break;
        }
  
        // required string mMac = 7;
        case 7: {
          message.mMac = readString(bb, readVarint32(bb));
          break;
        }
  
        // optional string mAddress = 8;
        case 8: {
          message.mAddress = readString(bb, readVarint32(bb));
          break;
        }
  
        // optional string mIp = 9;
        case 9: {
          message.mIp = readString(bb, readVarint32(bb));
          break;
        }
  
        // optional string advertisingId = 10;
        case 10: {
          message.advertisingId = readString(bb, readVarint32(bb));
          break;
        }
  
        // optional int32 coinType = 11;
        case 11: {
          message.coinType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mType === undefined)
      throw new Error("Missing required field: mType");
  
    if (message.mAgentID === undefined)
      throw new Error("Missing required field: mAgentID");
  
    if (message.mAccount === undefined)
      throw new Error("Missing required field: mAccount");
  
    if (message.mPassWord === undefined)
      throw new Error("Missing required field: mPassWord");
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    if (message.mTimeStamp === undefined)
      throw new Error("Missing required field: mTimeStamp");
  
    if (message.mMac === undefined)
      throw new Error("Missing required field: mMac");
  
    return message;
  }
  
  export interface loginS2C {
    mResult: number;
    mUserID: number;
    mNickName: string;
    mAccount: string;
    mMoney: string;
    mBank: Long;
    mIsMan: boolean;
    mHeadIndex: string;
    mSignature: string;
    mIsSetBankPwd: boolean;
    mGameID: number;
    mRoomID: number;
    mDeskIndex: number;
    mSeatIndex: number;
    mAgentID: number;
    mTimeStamp: number;
    mNewServerIp?: string;
    mNewServerPort?: number;
    mIsBindPhone: boolean;
    mCollectWebAward?: number;
    mPlayTime?: number;
    mPlayTimeAward?: number;
    mGameType?: number;
    mGameTax?: number;
    mPassWord: string;
  }
  
  export function encodeloginS2C(message: loginS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeloginS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeloginS2C(message: loginS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mUserID = 2;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mUserID));
    }
  
    // required string mNickName = 3;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mNickName);
    }
  
    // required string mAccount = 4;
    let $mAccount = message.mAccount;
    if ($mAccount !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mAccount);
    }
  
    // required string mMoney = 5;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 42);
      writeString(bb, $mMoney);
    }
  
    // required int64 mBank = 6;
    let $mBank = message.mBank;
    if ($mBank !== undefined) {
      writeVarint32(bb, 48);
      writeVarint64(bb, $mBank);
    }
  
    // required bool mIsMan = 7;
    let $mIsMan = message.mIsMan;
    if ($mIsMan !== undefined) {
      writeVarint32(bb, 56);
      writeByte(bb, $mIsMan ? 1 : 0);
    }
  
    // required string mHeadIndex = 8;
    let $mHeadIndex = message.mHeadIndex;
    if ($mHeadIndex !== undefined) {
      writeVarint32(bb, 66);
      writeString(bb, $mHeadIndex);
    }
  
    // required string mSignature = 9;
    let $mSignature = message.mSignature;
    if ($mSignature !== undefined) {
      writeVarint32(bb, 74);
      writeString(bb, $mSignature);
    }
  
    // required bool mIsSetBankPwd = 10;
    let $mIsSetBankPwd = message.mIsSetBankPwd;
    if ($mIsSetBankPwd !== undefined) {
      writeVarint32(bb, 80);
      writeByte(bb, $mIsSetBankPwd ? 1 : 0);
    }
  
    // required int32 mGameID = 11;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 88);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 12;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 96);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskIndex = 13;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 104);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // required int32 mSeatIndex = 14;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 112);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  
    // required int32 mAgentID = 15;
    let $mAgentID = message.mAgentID;
    if ($mAgentID !== undefined) {
      writeVarint32(bb, 120);
      writeVarint64(bb, intToLong($mAgentID));
    }
  
    // required int32 mTimeStamp = 16;
    let $mTimeStamp = message.mTimeStamp;
    if ($mTimeStamp !== undefined) {
      writeVarint32(bb, 128);
      writeVarint64(bb, intToLong($mTimeStamp));
    }
  
    // optional string mNewServerIp = 17;
    let $mNewServerIp = message.mNewServerIp;
    if ($mNewServerIp !== undefined) {
      writeVarint32(bb, 138);
      writeString(bb, $mNewServerIp);
    }
  
    // optional int32 mNewServerPort = 18;
    let $mNewServerPort = message.mNewServerPort;
    if ($mNewServerPort !== undefined) {
      writeVarint32(bb, 144);
      writeVarint64(bb, intToLong($mNewServerPort));
    }
  
    // required bool mIsBindPhone = 19;
    let $mIsBindPhone = message.mIsBindPhone;
    if ($mIsBindPhone !== undefined) {
      writeVarint32(bb, 152);
      writeByte(bb, $mIsBindPhone ? 1 : 0);
    }
  
    // optional int32 mCollectWebAward = 20;
    let $mCollectWebAward = message.mCollectWebAward;
    if ($mCollectWebAward !== undefined) {
      writeVarint32(bb, 160);
      writeVarint64(bb, intToLong($mCollectWebAward));
    }
  
    // optional int32 mPlayTime = 21;
    let $mPlayTime = message.mPlayTime;
    if ($mPlayTime !== undefined) {
      writeVarint32(bb, 168);
      writeVarint64(bb, intToLong($mPlayTime));
    }
  
    // optional int32 mPlayTimeAward = 22;
    let $mPlayTimeAward = message.mPlayTimeAward;
    if ($mPlayTimeAward !== undefined) {
      writeVarint32(bb, 176);
      writeVarint64(bb, intToLong($mPlayTimeAward));
    }
  
    // optional int32 mGameType = 23;
    let $mGameType = message.mGameType;
    if ($mGameType !== undefined) {
      writeVarint32(bb, 184);
      writeVarint64(bb, intToLong($mGameType));
    }
  
    // optional int32 mGameTax = 24;
    let $mGameTax = message.mGameTax;
    if ($mGameTax !== undefined) {
      writeVarint32(bb, 192);
      writeVarint64(bb, intToLong($mGameTax));
    }
  
    // required string mPassWord = 25;
    let $mPassWord = message.mPassWord;
    if ($mPassWord !== undefined) {
      writeVarint32(bb, 202);
      writeString(bb, $mPassWord);
    }
  }
  
  export function decodeloginS2C(binary: Uint8Array): loginS2C {
    return _decodeloginS2C(wrapByteBuffer(binary));
  }
  
  function _decodeloginS2C(bb: ByteBuffer): loginS2C {
    let message: loginS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mUserID = 2;
        case 2: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        // required string mNickName = 3;
        case 3: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mAccount = 4;
        case 4: {
          message.mAccount = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mMoney = 5;
        case 5: {
          message.mMoney = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int64 mBank = 6;
        case 6: {
          message.mBank = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required bool mIsMan = 7;
        case 7: {
          message.mIsMan = !!readByte(bb);
          break;
        }
  
        // required string mHeadIndex = 8;
        case 8: {
          message.mHeadIndex = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mSignature = 9;
        case 9: {
          message.mSignature = readString(bb, readVarint32(bb));
          break;
        }
  
        // required bool mIsSetBankPwd = 10;
        case 10: {
          message.mIsSetBankPwd = !!readByte(bb);
          break;
        }
  
        // required int32 mGameID = 11;
        case 11: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 12;
        case 12: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskIndex = 13;
        case 13: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 14;
        case 14: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mAgentID = 15;
        case 15: {
          message.mAgentID = readVarint32(bb);
          break;
        }
  
        // required int32 mTimeStamp = 16;
        case 16: {
          message.mTimeStamp = readVarint32(bb);
          break;
        }
  
        // optional string mNewServerIp = 17;
        case 17: {
          message.mNewServerIp = readString(bb, readVarint32(bb));
          break;
        }
  
        // optional int32 mNewServerPort = 18;
        case 18: {
          message.mNewServerPort = readVarint32(bb);
          break;
        }
  
        // required bool mIsBindPhone = 19;
        case 19: {
          message.mIsBindPhone = !!readByte(bb);
          break;
        }
  
        // optional int32 mCollectWebAward = 20;
        case 20: {
          message.mCollectWebAward = readVarint32(bb);
          break;
        }
  
        // optional int32 mPlayTime = 21;
        case 21: {
          message.mPlayTime = readVarint32(bb);
          break;
        }
  
        // optional int32 mPlayTimeAward = 22;
        case 22: {
          message.mPlayTimeAward = readVarint32(bb);
          break;
        }
  
        // optional int32 mGameType = 23;
        case 23: {
          message.mGameType = readVarint32(bb);
          break;
        }
  
        // optional int32 mGameTax = 24;
        case 24: {
          message.mGameTax = readVarint32(bb);
          break;
        }
  
        // required string mPassWord = 25;
        case 25: {
          message.mPassWord = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    if (message.mAccount === undefined)
      throw new Error("Missing required field: mAccount");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mBank === undefined)
      throw new Error("Missing required field: mBank");
  
    if (message.mIsMan === undefined)
      throw new Error("Missing required field: mIsMan");
  
    if (message.mHeadIndex === undefined)
      throw new Error("Missing required field: mHeadIndex");
  
    if (message.mSignature === undefined)
      throw new Error("Missing required field: mSignature");
  
    if (message.mIsSetBankPwd === undefined)
      throw new Error("Missing required field: mIsSetBankPwd");
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    if (message.mAgentID === undefined)
      throw new Error("Missing required field: mAgentID");
  
    if (message.mTimeStamp === undefined)
      throw new Error("Missing required field: mTimeStamp");
  
    if (message.mIsBindPhone === undefined)
      throw new Error("Missing required field: mIsBindPhone");
  
    if (message.mPassWord === undefined)
      throw new Error("Missing required field: mPassWord");
  
    return message;
  }
  
  export interface registerC2S {
    mAgentID: number;
    mAccount: string;
    mNickName: string;
    mPassWord: string;
    mMac: string;
    mIp?: string;
  }
  
  export function encoderegisterC2S(message: registerC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderegisterC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderegisterC2S(message: registerC2S, bb: ByteBuffer): void {
    // required int32 mAgentID = 1;
    let $mAgentID = message.mAgentID;
    if ($mAgentID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mAgentID));
    }
  
    // required string mAccount = 2;
    let $mAccount = message.mAccount;
    if ($mAccount !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mAccount);
    }
  
    // required string mNickName = 3;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mNickName);
    }
  
    // required string mPassWord = 4;
    let $mPassWord = message.mPassWord;
    if ($mPassWord !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mPassWord);
    }
  
    // required string mMac = 5;
    let $mMac = message.mMac;
    if ($mMac !== undefined) {
      writeVarint32(bb, 42);
      writeString(bb, $mMac);
    }
  
    // optional string mIp = 6;
    let $mIp = message.mIp;
    if ($mIp !== undefined) {
      writeVarint32(bb, 50);
      writeString(bb, $mIp);
    }
  }
  
  export function decoderegisterC2S(binary: Uint8Array): registerC2S {
    return _decoderegisterC2S(wrapByteBuffer(binary));
  }
  
  function _decoderegisterC2S(bb: ByteBuffer): registerC2S {
    let message: registerC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mAgentID = 1;
        case 1: {
          message.mAgentID = readVarint32(bb);
          break;
        }
  
        // required string mAccount = 2;
        case 2: {
          message.mAccount = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mNickName = 3;
        case 3: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mPassWord = 4;
        case 4: {
          message.mPassWord = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mMac = 5;
        case 5: {
          message.mMac = readString(bb, readVarint32(bb));
          break;
        }
  
        // optional string mIp = 6;
        case 6: {
          message.mIp = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAgentID === undefined)
      throw new Error("Missing required field: mAgentID");
  
    if (message.mAccount === undefined)
      throw new Error("Missing required field: mAccount");
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    if (message.mPassWord === undefined)
      throw new Error("Missing required field: mPassWord");
  
    if (message.mMac === undefined)
      throw new Error("Missing required field: mMac");
  
    return message;
  }
  
  export interface registerS2C {
    mResult: number;
  }
  
  export function encoderegisterS2C(message: registerS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderegisterS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderegisterS2C(message: registerS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decoderegisterS2C(binary: Uint8Array): registerS2C {
    return _decoderegisterS2C(wrapByteBuffer(binary));
  }
  
  function _decoderegisterS2C(bb: ByteBuffer): registerS2C {
    let message: registerS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface bindAccountC2S {
    mAccount: string;
    mPassWord: string;
  }
  
  export function encodebindAccountC2S(message: bindAccountC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodebindAccountC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebindAccountC2S(message: bindAccountC2S, bb: ByteBuffer): void {
    // required string mAccount = 1;
    let $mAccount = message.mAccount;
    if ($mAccount !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mAccount);
    }
  
    // required string mPassWord = 2;
    let $mPassWord = message.mPassWord;
    if ($mPassWord !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mPassWord);
    }
  }
  
  export function decodebindAccountC2S(binary: Uint8Array): bindAccountC2S {
    return _decodebindAccountC2S(wrapByteBuffer(binary));
  }
  
  function _decodebindAccountC2S(bb: ByteBuffer): bindAccountC2S {
    let message: bindAccountC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mAccount = 1;
        case 1: {
          message.mAccount = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mPassWord = 2;
        case 2: {
          message.mPassWord = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAccount === undefined)
      throw new Error("Missing required field: mAccount");
  
    if (message.mPassWord === undefined)
      throw new Error("Missing required field: mPassWord");
  
    return message;
  }
  
  export interface bindAccountS2C {
    mResult: number;
  }
  
  export function encodebindAccountS2C(message: bindAccountS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodebindAccountS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebindAccountS2C(message: bindAccountS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decodebindAccountS2C(binary: Uint8Array): bindAccountS2C {
    return _decodebindAccountS2C(wrapByteBuffer(binary));
  }
  
  function _decodebindAccountS2C(bb: ByteBuffer): bindAccountS2C {
    let message: bindAccountS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface bindPhoneNumC2S {
    mPhoneNum: string;
    mVerifyCode: string;
  }
  
  export function encodebindPhoneNumC2S(message: bindPhoneNumC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodebindPhoneNumC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebindPhoneNumC2S(message: bindPhoneNumC2S, bb: ByteBuffer): void {
    // required string mPhoneNum = 1;
    let $mPhoneNum = message.mPhoneNum;
    if ($mPhoneNum !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mPhoneNum);
    }
  
    // required string mVerifyCode = 2;
    let $mVerifyCode = message.mVerifyCode;
    if ($mVerifyCode !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mVerifyCode);
    }
  }
  
  export function decodebindPhoneNumC2S(binary: Uint8Array): bindPhoneNumC2S {
    return _decodebindPhoneNumC2S(wrapByteBuffer(binary));
  }
  
  function _decodebindPhoneNumC2S(bb: ByteBuffer): bindPhoneNumC2S {
    let message: bindPhoneNumC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mPhoneNum = 1;
        case 1: {
          message.mPhoneNum = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mVerifyCode = 2;
        case 2: {
          message.mVerifyCode = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mPhoneNum === undefined)
      throw new Error("Missing required field: mPhoneNum");
  
    if (message.mVerifyCode === undefined)
      throw new Error("Missing required field: mVerifyCode");
  
    return message;
  }
  
  export interface bindPhoneNumS2C {
    mResult: number;
    mAwardMoney: Long;
  }
  
  export function encodebindPhoneNumS2C(message: bindPhoneNumS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodebindPhoneNumS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebindPhoneNumS2C(message: bindPhoneNumS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int64 mAwardMoney = 2;
    let $mAwardMoney = message.mAwardMoney;
    if ($mAwardMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mAwardMoney);
    }
  }
  
  export function decodebindPhoneNumS2C(binary: Uint8Array): bindPhoneNumS2C {
    return _decodebindPhoneNumS2C(wrapByteBuffer(binary));
  }
  
  function _decodebindPhoneNumS2C(bb: ByteBuffer): bindPhoneNumS2C {
    let message: bindPhoneNumS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int64 mAwardMoney = 2;
        case 2: {
          message.mAwardMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mAwardMoney === undefined)
      throw new Error("Missing required field: mAwardMoney");
  
    return message;
  }
  
  export interface emailInfo {
    mEmailID: number;
    mTimeStamp: number;
    mTitle: string;
    mContent: string;
  }
  
  export function encodeemailInfo(message: emailInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeemailInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeemailInfo(message: emailInfo, bb: ByteBuffer): void {
    // required int32 mEmailID = 1;
    let $mEmailID = message.mEmailID;
    if ($mEmailID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mEmailID));
    }
  
    // required int32 mTimeStamp = 2;
    let $mTimeStamp = message.mTimeStamp;
    if ($mTimeStamp !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mTimeStamp));
    }
  
    // required string mTitle = 3;
    let $mTitle = message.mTitle;
    if ($mTitle !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mTitle);
    }
  
    // required string mContent = 4;
    let $mContent = message.mContent;
    if ($mContent !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mContent);
    }
  }
  
  export function decodeemailInfo(binary: Uint8Array): emailInfo {
    return _decodeemailInfo(wrapByteBuffer(binary));
  }
  
  function _decodeemailInfo(bb: ByteBuffer): emailInfo {
    let message: emailInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mEmailID = 1;
        case 1: {
          message.mEmailID = readVarint32(bb);
          break;
        }
  
        // required int32 mTimeStamp = 2;
        case 2: {
          message.mTimeStamp = readVarint32(bb);
          break;
        }
  
        // required string mTitle = 3;
        case 3: {
          message.mTitle = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mContent = 4;
        case 4: {
          message.mContent = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mEmailID === undefined)
      throw new Error("Missing required field: mEmailID");
  
    if (message.mTimeStamp === undefined)
      throw new Error("Missing required field: mTimeStamp");
  
    if (message.mTitle === undefined)
      throw new Error("Missing required field: mTitle");
  
    if (message.mContent === undefined)
      throw new Error("Missing required field: mContent");
  
    return message;
  }
  
  export interface requestEmailC2S {
  }
  
  export function encoderequestEmailC2S(message: requestEmailC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestEmailC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestEmailC2S(message: requestEmailC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestEmailC2S(binary: Uint8Array): requestEmailC2S {
    return _decoderequestEmailC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestEmailC2S(bb: ByteBuffer): requestEmailC2S {
    let message: requestEmailC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface pushEmailS2C {
    mEmails?: emailInfo[];
  }
  
  export function encodepushEmailS2C(message: pushEmailS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushEmailS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushEmailS2C(message: pushEmailS2C, bb: ByteBuffer): void {
    // repeated emailInfo mEmails = 1;
    let array$mEmails = message.mEmails;
    if (array$mEmails !== undefined) {
      for (let value of array$mEmails) {
        writeVarint32(bb, 10);
        let nested = popByteBuffer();
        _encodeemailInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decodepushEmailS2C(binary: Uint8Array): pushEmailS2C {
    return _decodepushEmailS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushEmailS2C(bb: ByteBuffer): pushEmailS2C {
    let message: pushEmailS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated emailInfo mEmails = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          let values = message.mEmails || (message.mEmails = []);
          values.push(_decodeemailInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface confirmEmailC2S {
    mEmailIDs?: number[];
  }
  
  export function encodeconfirmEmailC2S(message: confirmEmailC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodeconfirmEmailC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeconfirmEmailC2S(message: confirmEmailC2S, bb: ByteBuffer): void {
    // repeated int32 mEmailIDs = 1;
    let array$mEmailIDs = message.mEmailIDs;
    if (array$mEmailIDs !== undefined) {
      let packed = popByteBuffer();
      for (let value of array$mEmailIDs) {
        writeVarint64(packed, intToLong(value));
      }
      writeVarint32(bb, 10);
      writeVarint32(bb, packed.offset);
      writeByteBuffer(bb, packed);
      pushByteBuffer(packed);
    }
  }
  
  export function decodeconfirmEmailC2S(binary: Uint8Array): confirmEmailC2S {
    return _decodeconfirmEmailC2S(wrapByteBuffer(binary));
  }
  
  function _decodeconfirmEmailC2S(bb: ByteBuffer): confirmEmailC2S {
    let message: confirmEmailC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated int32 mEmailIDs = 1;
        case 1: {
          let values = message.mEmailIDs || (message.mEmailIDs = []);
          if ((tag & 7) === 2) {
            let outerLimit = pushTemporaryLength(bb);
            while (!isAtEnd(bb)) {
              values.push(readVarint32(bb));
            }
            bb.limit = outerLimit;
          } else {
            values.push(readVarint32(bb));
          }
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface playerInfo {
    mUserID: number;
    mNickName: string;
    mHeadIndex?: number;
    mIsMan?: boolean;
    mMoney?: Long;
    mSignature?: string;
  }
  
  export function encodeplayerInfo(message: playerInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeplayerInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeplayerInfo(message: playerInfo, bb: ByteBuffer): void {
    // required int32 mUserID = 1;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mUserID));
    }
  
    // required string mNickName = 2;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mNickName);
    }
  
    // optional int32 mHeadIndex = 3;
    let $mHeadIndex = message.mHeadIndex;
    if ($mHeadIndex !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mHeadIndex));
    }
  
    // optional bool mIsMan = 4;
    let $mIsMan = message.mIsMan;
    if ($mIsMan !== undefined) {
      writeVarint32(bb, 32);
      writeByte(bb, $mIsMan ? 1 : 0);
    }
  
    // optional int64 mMoney = 5;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, $mMoney);
    }
  
    // optional string mSignature = 6;
    let $mSignature = message.mSignature;
    if ($mSignature !== undefined) {
      writeVarint32(bb, 50);
      writeString(bb, $mSignature);
    }
  }
  
  export function decodeplayerInfo(binary: Uint8Array): playerInfo {
    return _decodeplayerInfo(wrapByteBuffer(binary));
  }
  
  function _decodeplayerInfo(bb: ByteBuffer): playerInfo {
    let message: playerInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mUserID = 1;
        case 1: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        // required string mNickName = 2;
        case 2: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // optional int32 mHeadIndex = 3;
        case 3: {
          message.mHeadIndex = readVarint32(bb);
          break;
        }
  
        // optional bool mIsMan = 4;
        case 4: {
          message.mIsMan = !!readByte(bb);
          break;
        }
  
        // optional int64 mMoney = 5;
        case 5: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // optional string mSignature = 6;
        case 6: {
          message.mSignature = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    return message;
  }
  
  export interface requestRankC2S {
  }
  
  export function encoderequestRankC2S(message: requestRankC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRankC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRankC2S(message: requestRankC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestRankC2S(binary: Uint8Array): requestRankC2S {
    return _decoderequestRankC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestRankC2S(bb: ByteBuffer): requestRankC2S {
    let message: requestRankC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface rankInfo {
    mOrder: number;
    mData: playerInfo;
  }
  
  export function encoderankInfo(message: rankInfo): Uint8Array {
    let bb = popByteBuffer();
    _encoderankInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderankInfo(message: rankInfo, bb: ByteBuffer): void {
    // required int32 mOrder = 1;
    let $mOrder = message.mOrder;
    if ($mOrder !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mOrder));
    }
  
    // required playerInfo mData = 2;
    let $mData = message.mData;
    if ($mData !== undefined) {
      writeVarint32(bb, 18);
      let nested = popByteBuffer();
      _encodeplayerInfo($mData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decoderankInfo(binary: Uint8Array): rankInfo {
    return _decoderankInfo(wrapByteBuffer(binary));
  }
  
  function _decoderankInfo(bb: ByteBuffer): rankInfo {
    let message: rankInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mOrder = 1;
        case 1: {
          message.mOrder = readVarint32(bb);
          break;
        }
  
        // required playerInfo mData = 2;
        case 2: {
          let limit = pushTemporaryLength(bb);
          message.mData = _decodeplayerInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mOrder === undefined)
      throw new Error("Missing required field: mOrder");
  
    if (message.mData === undefined)
      throw new Error("Missing required field: mData");
  
    return message;
  }
  
  export interface requestRankS2C {
    mRankInfos?: rankInfo[];
  }
  
  export function encoderequestRankS2C(message: requestRankS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRankS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRankS2C(message: requestRankS2C, bb: ByteBuffer): void {
    // repeated rankInfo mRankInfos = 1;
    let array$mRankInfos = message.mRankInfos;
    if (array$mRankInfos !== undefined) {
      for (let value of array$mRankInfos) {
        writeVarint32(bb, 10);
        let nested = popByteBuffer();
        _encoderankInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decoderequestRankS2C(binary: Uint8Array): requestRankS2C {
    return _decoderequestRankS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestRankS2C(bb: ByteBuffer): requestRankS2C {
    let message: requestRankS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated rankInfo mRankInfos = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          let values = message.mRankInfos || (message.mRankInfos = []);
          values.push(_decoderankInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestPlayerInfoC2S {
    mUserID: number;
  }
  
  export function encoderequestPlayerInfoC2S(message: requestPlayerInfoC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPlayerInfoC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPlayerInfoC2S(message: requestPlayerInfoC2S, bb: ByteBuffer): void {
    // required int32 mUserID = 1;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mUserID));
    }
  }
  
  export function decoderequestPlayerInfoC2S(binary: Uint8Array): requestPlayerInfoC2S {
    return _decoderequestPlayerInfoC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestPlayerInfoC2S(bb: ByteBuffer): requestPlayerInfoC2S {
    let message: requestPlayerInfoC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mUserID = 1;
        case 1: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    return message;
  }
  
  export interface requestPlayerInfoS2C {
    mResult: number;
    mData?: playerInfo;
  }
  
  export function encoderequestPlayerInfoS2C(message: requestPlayerInfoS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPlayerInfoS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPlayerInfoS2C(message: requestPlayerInfoS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // optional playerInfo mData = 2;
    let $mData = message.mData;
    if ($mData !== undefined) {
      writeVarint32(bb, 18);
      let nested = popByteBuffer();
      _encodeplayerInfo($mData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decoderequestPlayerInfoS2C(binary: Uint8Array): requestPlayerInfoS2C {
    return _decoderequestPlayerInfoS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestPlayerInfoS2C(bb: ByteBuffer): requestPlayerInfoS2C {
    let message: requestPlayerInfoS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // optional playerInfo mData = 2;
        case 2: {
          let limit = pushTemporaryLength(bb);
          message.mData = _decodeplayerInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface setBankPwdC2S {
    mOldPwd: string;
    mNewPwd: string;
  }
  
  export function encodesetBankPwdC2S(message: setBankPwdC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodesetBankPwdC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodesetBankPwdC2S(message: setBankPwdC2S, bb: ByteBuffer): void {
    // required string mOldPwd = 1;
    let $mOldPwd = message.mOldPwd;
    if ($mOldPwd !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mOldPwd);
    }
  
    // required string mNewPwd = 2;
    let $mNewPwd = message.mNewPwd;
    if ($mNewPwd !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mNewPwd);
    }
  }
  
  export function decodesetBankPwdC2S(binary: Uint8Array): setBankPwdC2S {
    return _decodesetBankPwdC2S(wrapByteBuffer(binary));
  }
  
  function _decodesetBankPwdC2S(bb: ByteBuffer): setBankPwdC2S {
    let message: setBankPwdC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mOldPwd = 1;
        case 1: {
          message.mOldPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mNewPwd = 2;
        case 2: {
          message.mNewPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mOldPwd === undefined)
      throw new Error("Missing required field: mOldPwd");
  
    if (message.mNewPwd === undefined)
      throw new Error("Missing required field: mNewPwd");
  
    return message;
  }
  
  export interface setBankPwdS2C {
    mResult: number;
    mNewPwd: string;
  }
  
  export function encodesetBankPwdS2C(message: setBankPwdS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodesetBankPwdS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodesetBankPwdS2C(message: setBankPwdS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required string mNewPwd = 2;
    let $mNewPwd = message.mNewPwd;
    if ($mNewPwd !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mNewPwd);
    }
  }
  
  export function decodesetBankPwdS2C(binary: Uint8Array): setBankPwdS2C {
    return _decodesetBankPwdS2C(wrapByteBuffer(binary));
  }
  
  function _decodesetBankPwdS2C(bb: ByteBuffer): setBankPwdS2C {
    let message: setBankPwdS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required string mNewPwd = 2;
        case 2: {
          message.mNewPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mNewPwd === undefined)
      throw new Error("Missing required field: mNewPwd");
  
    return message;
  }
  
  export interface bankMoneyChangeC2S {
    mIsPush: boolean;
    mChangeMoney: Long;
    mBankPwd: string;
  }
  
  export function encodebankMoneyChangeC2S(message: bankMoneyChangeC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodebankMoneyChangeC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebankMoneyChangeC2S(message: bankMoneyChangeC2S, bb: ByteBuffer): void {
    // required bool mIsPush = 1;
    let $mIsPush = message.mIsPush;
    if ($mIsPush !== undefined) {
      writeVarint32(bb, 8);
      writeByte(bb, $mIsPush ? 1 : 0);
    }
  
    // required int64 mChangeMoney = 2;
    let $mChangeMoney = message.mChangeMoney;
    if ($mChangeMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mChangeMoney);
    }
  
    // required string mBankPwd = 3;
    let $mBankPwd = message.mBankPwd;
    if ($mBankPwd !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mBankPwd);
    }
  }
  
  export function decodebankMoneyChangeC2S(binary: Uint8Array): bankMoneyChangeC2S {
    return _decodebankMoneyChangeC2S(wrapByteBuffer(binary));
  }
  
  function _decodebankMoneyChangeC2S(bb: ByteBuffer): bankMoneyChangeC2S {
    let message: bankMoneyChangeC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required bool mIsPush = 1;
        case 1: {
          message.mIsPush = !!readByte(bb);
          break;
        }
  
        // required int64 mChangeMoney = 2;
        case 2: {
          message.mChangeMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required string mBankPwd = 3;
        case 3: {
          message.mBankPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mIsPush === undefined)
      throw new Error("Missing required field: mIsPush");
  
    if (message.mChangeMoney === undefined)
      throw new Error("Missing required field: mChangeMoney");
  
    if (message.mBankPwd === undefined)
      throw new Error("Missing required field: mBankPwd");
  
    return message;
  }
  
  export interface bankMoneyChangeS2C {
    mResult: number;
    mIsPush: boolean;
    mMoney: Long;
    mBank: Long;
  }
  
  export function encodebankMoneyChangeS2C(message: bankMoneyChangeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodebankMoneyChangeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebankMoneyChangeS2C(message: bankMoneyChangeS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required bool mIsPush = 2;
    let $mIsPush = message.mIsPush;
    if ($mIsPush !== undefined) {
      writeVarint32(bb, 16);
      writeByte(bb, $mIsPush ? 1 : 0);
    }
  
    // required int64 mMoney = 3;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, $mMoney);
    }
  
    // required int64 mBank = 4;
    let $mBank = message.mBank;
    if ($mBank !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, $mBank);
    }
  }
  
  export function decodebankMoneyChangeS2C(binary: Uint8Array): bankMoneyChangeS2C {
    return _decodebankMoneyChangeS2C(wrapByteBuffer(binary));
  }
  
  function _decodebankMoneyChangeS2C(bb: ByteBuffer): bankMoneyChangeS2C {
    let message: bankMoneyChangeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required bool mIsPush = 2;
        case 2: {
          message.mIsPush = !!readByte(bb);
          break;
        }
  
        // required int64 mMoney = 3;
        case 3: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required int64 mBank = 4;
        case 4: {
          message.mBank = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mIsPush === undefined)
      throw new Error("Missing required field: mIsPush");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mBank === undefined)
      throw new Error("Missing required field: mBank");
  
    return message;
  }
  
  export interface giveMoneyC2S {
    mReceiverID: number;
    mMoney: Long;
    mBankPwd: string;
  }
  
  export function encodegiveMoneyC2S(message: giveMoneyC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodegiveMoneyC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodegiveMoneyC2S(message: giveMoneyC2S, bb: ByteBuffer): void {
    // required int32 mReceiverID = 1;
    let $mReceiverID = message.mReceiverID;
    if ($mReceiverID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mReceiverID));
    }
  
    // required int64 mMoney = 2;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mMoney);
    }
  
    // required string mBankPwd = 3;
    let $mBankPwd = message.mBankPwd;
    if ($mBankPwd !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mBankPwd);
    }
  }
  
  export function decodegiveMoneyC2S(binary: Uint8Array): giveMoneyC2S {
    return _decodegiveMoneyC2S(wrapByteBuffer(binary));
  }
  
  function _decodegiveMoneyC2S(bb: ByteBuffer): giveMoneyC2S {
    let message: giveMoneyC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mReceiverID = 1;
        case 1: {
          message.mReceiverID = readVarint32(bb);
          break;
        }
  
        // required int64 mMoney = 2;
        case 2: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required string mBankPwd = 3;
        case 3: {
          message.mBankPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mReceiverID === undefined)
      throw new Error("Missing required field: mReceiverID");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mBankPwd === undefined)
      throw new Error("Missing required field: mBankPwd");
  
    return message;
  }
  
  export interface giveMoneyS2C {
    mResult: number;
    mMoney: Long;
    mBank: Long;
  }
  
  export function encodegiveMoneyS2C(message: giveMoneyS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodegiveMoneyS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodegiveMoneyS2C(message: giveMoneyS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int64 mMoney = 2;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mMoney);
    }
  
    // required int64 mBank = 3;
    let $mBank = message.mBank;
    if ($mBank !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, $mBank);
    }
  }
  
  export function decodegiveMoneyS2C(binary: Uint8Array): giveMoneyS2C {
    return _decodegiveMoneyS2C(wrapByteBuffer(binary));
  }
  
  function _decodegiveMoneyS2C(bb: ByteBuffer): giveMoneyS2C {
    let message: giveMoneyS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int64 mMoney = 2;
        case 2: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required int64 mBank = 3;
        case 3: {
          message.mBank = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mBank === undefined)
      throw new Error("Missing required field: mBank");
  
    return message;
  }
  
  export interface notificationS2C {
    mContent?: string[];
  }
  
  export function encodenotificationS2C(message: notificationS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodenotificationS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodenotificationS2C(message: notificationS2C, bb: ByteBuffer): void {
    // repeated string mContent = 1;
    let array$mContent = message.mContent;
    if (array$mContent !== undefined) {
      for (let value of array$mContent) {
        writeVarint32(bb, 10);
        writeString(bb, value);
      }
    }
  }
  
  export function decodenotificationS2C(binary: Uint8Array): notificationS2C {
    return _decodenotificationS2C(wrapByteBuffer(binary));
  }
  
  function _decodenotificationS2C(bb: ByteBuffer): notificationS2C {
    let message: notificationS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated string mContent = 1;
        case 1: {
          let values = message.mContent || (message.mContent = []);
          values.push(readString(bb, readVarint32(bb)));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface changeAccountDataC2S {
    mNickName: string;
    mIsMan: boolean;
    mHeadIndex: number;
    mSignature?: string;
  }
  
  export function encodechangeAccountDataC2S(message: changeAccountDataC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodechangeAccountDataC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodechangeAccountDataC2S(message: changeAccountDataC2S, bb: ByteBuffer): void {
    // required string mNickName = 1;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mNickName);
    }
  
    // required bool mIsMan = 2;
    let $mIsMan = message.mIsMan;
    if ($mIsMan !== undefined) {
      writeVarint32(bb, 16);
      writeByte(bb, $mIsMan ? 1 : 0);
    }
  
    // required int32 mHeadIndex = 3;
    let $mHeadIndex = message.mHeadIndex;
    if ($mHeadIndex !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mHeadIndex));
    }
  
    // optional string mSignature = 4;
    let $mSignature = message.mSignature;
    if ($mSignature !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mSignature);
    }
  }
  
  export function decodechangeAccountDataC2S(binary: Uint8Array): changeAccountDataC2S {
    return _decodechangeAccountDataC2S(wrapByteBuffer(binary));
  }
  
  function _decodechangeAccountDataC2S(bb: ByteBuffer): changeAccountDataC2S {
    let message: changeAccountDataC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mNickName = 1;
        case 1: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required bool mIsMan = 2;
        case 2: {
          message.mIsMan = !!readByte(bb);
          break;
        }
  
        // required int32 mHeadIndex = 3;
        case 3: {
          message.mHeadIndex = readVarint32(bb);
          break;
        }
  
        // optional string mSignature = 4;
        case 4: {
          message.mSignature = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    if (message.mIsMan === undefined)
      throw new Error("Missing required field: mIsMan");
  
    if (message.mHeadIndex === undefined)
      throw new Error("Missing required field: mHeadIndex");
  
    return message;
  }
  
  export interface changeAccountDataS2C {
    mResult: number;
  }
  
  export function encodechangeAccountDataS2C(message: changeAccountDataS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodechangeAccountDataS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodechangeAccountDataS2C(message: changeAccountDataS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decodechangeAccountDataS2C(binary: Uint8Array): changeAccountDataS2C {
    return _decodechangeAccountDataS2C(wrapByteBuffer(binary));
  }
  
  function _decodechangeAccountDataS2C(bb: ByteBuffer): changeAccountDataS2C {
    let message: changeAccountDataS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface changeLoginPwdC2S {
    mOldPwd: string;
    mNewPwd: string;
  }
  
  export function encodechangeLoginPwdC2S(message: changeLoginPwdC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodechangeLoginPwdC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodechangeLoginPwdC2S(message: changeLoginPwdC2S, bb: ByteBuffer): void {
    // required string mOldPwd = 1;
    let $mOldPwd = message.mOldPwd;
    if ($mOldPwd !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mOldPwd);
    }
  
    // required string mNewPwd = 2;
    let $mNewPwd = message.mNewPwd;
    if ($mNewPwd !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mNewPwd);
    }
  }
  
  export function decodechangeLoginPwdC2S(binary: Uint8Array): changeLoginPwdC2S {
    return _decodechangeLoginPwdC2S(wrapByteBuffer(binary));
  }
  
  function _decodechangeLoginPwdC2S(bb: ByteBuffer): changeLoginPwdC2S {
    let message: changeLoginPwdC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mOldPwd = 1;
        case 1: {
          message.mOldPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mNewPwd = 2;
        case 2: {
          message.mNewPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mOldPwd === undefined)
      throw new Error("Missing required field: mOldPwd");
  
    if (message.mNewPwd === undefined)
      throw new Error("Missing required field: mNewPwd");
  
    return message;
  }
  
  export interface changeLoginPwdS2C {
    mResult: number;
  }
  
  export function encodechangeLoginPwdS2C(message: changeLoginPwdS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodechangeLoginPwdS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodechangeLoginPwdS2C(message: changeLoginPwdS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decodechangeLoginPwdS2C(binary: Uint8Array): changeLoginPwdS2C {
    return _decodechangeLoginPwdS2C(wrapByteBuffer(binary));
  }
  
  function _decodechangeLoginPwdS2C(bb: ByteBuffer): changeLoginPwdS2C {
    let message: changeLoginPwdS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface verifyBankPwdC2S {
    mBankPwd: string;
  }
  
  export function encodeverifyBankPwdC2S(message: verifyBankPwdC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodeverifyBankPwdC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeverifyBankPwdC2S(message: verifyBankPwdC2S, bb: ByteBuffer): void {
    // required string mBankPwd = 1;
    let $mBankPwd = message.mBankPwd;
    if ($mBankPwd !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mBankPwd);
    }
  }
  
  export function decodeverifyBankPwdC2S(binary: Uint8Array): verifyBankPwdC2S {
    return _decodeverifyBankPwdC2S(wrapByteBuffer(binary));
  }
  
  function _decodeverifyBankPwdC2S(bb: ByteBuffer): verifyBankPwdC2S {
    let message: verifyBankPwdC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mBankPwd = 1;
        case 1: {
          message.mBankPwd = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mBankPwd === undefined)
      throw new Error("Missing required field: mBankPwd");
  
    return message;
  }
  
  export interface verifyBankPwdS2C {
    mResult: number;
  }
  
  export function encodeverifyBankPwdS2C(message: verifyBankPwdS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeverifyBankPwdS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeverifyBankPwdS2C(message: verifyBankPwdS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decodeverifyBankPwdS2C(binary: Uint8Array): verifyBankPwdS2C {
    return _decodeverifyBankPwdS2C(wrapByteBuffer(binary));
  }
  
  function _decodeverifyBankPwdS2C(bb: ByteBuffer): verifyBankPwdS2C {
    let message: verifyBankPwdS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface playerMoneyChangeS2C {
    mUserID: number;
    mMoney: Long;
    mType: number;
  }
  
  export function encodeplayerMoneyChangeS2C(message: playerMoneyChangeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeplayerMoneyChangeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeplayerMoneyChangeS2C(message: playerMoneyChangeS2C, bb: ByteBuffer): void {
    // required int32 mUserID = 1;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mUserID));
    }
  
    // required int64 mMoney = 2;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mMoney);
    }
  
    // required int32 mType = 3;
    let $mType = message.mType;
    if ($mType !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mType));
    }
  }
  
  export function decodeplayerMoneyChangeS2C(binary: Uint8Array): playerMoneyChangeS2C {
    return _decodeplayerMoneyChangeS2C(wrapByteBuffer(binary));
  }
  
  function _decodeplayerMoneyChangeS2C(bb: ByteBuffer): playerMoneyChangeS2C {
    let message: playerMoneyChangeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mUserID = 1;
        case 1: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        // required int64 mMoney = 2;
        case 2: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required int32 mType = 3;
        case 3: {
          message.mType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mType === undefined)
      throw new Error("Missing required field: mType");
  
    return message;
  }
  
  export interface playerBankChangeS2C {
    mUserID: number;
    mBank: Long;
  }
  
  export function encodeplayerBankChangeS2C(message: playerBankChangeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeplayerBankChangeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeplayerBankChangeS2C(message: playerBankChangeS2C, bb: ByteBuffer): void {
    // required int32 mUserID = 1;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mUserID));
    }
  
    // required int64 mBank = 2;
    let $mBank = message.mBank;
    if ($mBank !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mBank);
    }
  }
  
  export function decodeplayerBankChangeS2C(binary: Uint8Array): playerBankChangeS2C {
    return _decodeplayerBankChangeS2C(wrapByteBuffer(binary));
  }
  
  function _decodeplayerBankChangeS2C(bb: ByteBuffer): playerBankChangeS2C {
    let message: playerBankChangeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mUserID = 1;
        case 1: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        // required int64 mBank = 2;
        case 2: {
          message.mBank = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    if (message.mBank === undefined)
      throw new Error("Missing required field: mBank");
  
    return message;
  }
  
  export interface playerInfoChangeS2C {
    mUserID: number;
    mIsMan: boolean;
    mSignature: string;
    mHeadIndex: number;
    mNickName: string;
  }
  
  export function encodeplayerInfoChangeS2C(message: playerInfoChangeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeplayerInfoChangeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeplayerInfoChangeS2C(message: playerInfoChangeS2C, bb: ByteBuffer): void {
    // required int32 mUserID = 1;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mUserID));
    }
  
    // required bool mIsMan = 2;
    let $mIsMan = message.mIsMan;
    if ($mIsMan !== undefined) {
      writeVarint32(bb, 16);
      writeByte(bb, $mIsMan ? 1 : 0);
    }
  
    // required string mSignature = 3;
    let $mSignature = message.mSignature;
    if ($mSignature !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mSignature);
    }
  
    // required int32 mHeadIndex = 4;
    let $mHeadIndex = message.mHeadIndex;
    if ($mHeadIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mHeadIndex));
    }
  
    // required string mNickName = 5;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 42);
      writeString(bb, $mNickName);
    }
  }
  
  export function decodeplayerInfoChangeS2C(binary: Uint8Array): playerInfoChangeS2C {
    return _decodeplayerInfoChangeS2C(wrapByteBuffer(binary));
  }
  
  function _decodeplayerInfoChangeS2C(bb: ByteBuffer): playerInfoChangeS2C {
    let message: playerInfoChangeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mUserID = 1;
        case 1: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        // required bool mIsMan = 2;
        case 2: {
          message.mIsMan = !!readByte(bb);
          break;
        }
  
        // required string mSignature = 3;
        case 3: {
          message.mSignature = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mHeadIndex = 4;
        case 4: {
          message.mHeadIndex = readVarint32(bb);
          break;
        }
  
        // required string mNickName = 5;
        case 5: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    if (message.mIsMan === undefined)
      throw new Error("Missing required field: mIsMan");
  
    if (message.mSignature === undefined)
      throw new Error("Missing required field: mSignature");
  
    if (message.mHeadIndex === undefined)
      throw new Error("Missing required field: mHeadIndex");
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    return message;
  }
  
  export interface serverKickClientS2C {
    mCode: number;
  }
  
  export function encodeserverKickClientS2C(message: serverKickClientS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeserverKickClientS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeserverKickClientS2C(message: serverKickClientS2C, bb: ByteBuffer): void {
    // required int32 mCode = 1;
    let $mCode = message.mCode;
    if ($mCode !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mCode));
    }
  }
  
  export function decodeserverKickClientS2C(binary: Uint8Array): serverKickClientS2C {
    return _decodeserverKickClientS2C(wrapByteBuffer(binary));
  }
  
  function _decodeserverKickClientS2C(bb: ByteBuffer): serverKickClientS2C {
    let message: serverKickClientS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mCode = 1;
        case 1: {
          message.mCode = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mCode === undefined)
      throw new Error("Missing required field: mCode");
  
    return message;
  }
  
  export interface requestFreeMoneyC2S {
  }
  
  export function encoderequestFreeMoneyC2S(message: requestFreeMoneyC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestFreeMoneyC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestFreeMoneyC2S(message: requestFreeMoneyC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestFreeMoneyC2S(binary: Uint8Array): requestFreeMoneyC2S {
    return _decoderequestFreeMoneyC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestFreeMoneyC2S(bb: ByteBuffer): requestFreeMoneyC2S {
    let message: requestFreeMoneyC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestFreeMoneyS2C {
    mResult: number;
    mIndex: number;
    mAwards?: Long[];
  }
  
  export function encoderequestFreeMoneyS2C(message: requestFreeMoneyS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestFreeMoneyS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestFreeMoneyS2C(message: requestFreeMoneyS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mIndex = 2;
    let $mIndex = message.mIndex;
    if ($mIndex !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mIndex));
    }
  
    // repeated int64 mAwards = 3;
    let array$mAwards = message.mAwards;
    if (array$mAwards !== undefined) {
      let packed = popByteBuffer();
      for (let value of array$mAwards) {
        writeVarint64(packed, value);
      }
      writeVarint32(bb, 26);
      writeVarint32(bb, packed.offset);
      writeByteBuffer(bb, packed);
      pushByteBuffer(packed);
    }
  }
  
  export function decoderequestFreeMoneyS2C(binary: Uint8Array): requestFreeMoneyS2C {
    return _decoderequestFreeMoneyS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestFreeMoneyS2C(bb: ByteBuffer): requestFreeMoneyS2C {
    let message: requestFreeMoneyS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mIndex = 2;
        case 2: {
          message.mIndex = readVarint32(bb);
          break;
        }
  
        // repeated int64 mAwards = 3;
        case 3: {
          let values = message.mAwards || (message.mAwards = []);
          if ((tag & 7) === 2) {
            let outerLimit = pushTemporaryLength(bb);
            while (!isAtEnd(bb)) {
              values.push(readVarint64(bb, /* unsigned */ false));
            }
            bb.limit = outerLimit;
          } else {
            values.push(readVarint64(bb, /* unsigned */ false));
          }
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mIndex === undefined)
      throw new Error("Missing required field: mIndex");
  
    return message;
  }
  
  export interface requestRoomListC2S {
    mGameID: number;
    mGameType: number;
  }
  
  export function encoderequestRoomListC2S(message: requestRoomListC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRoomListC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRoomListC2S(message: requestRoomListC2S, bb: ByteBuffer): void {
    // required int32 mGameID = 1;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mGameType = 2;
    let $mGameType = message.mGameType;
    if ($mGameType !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mGameType));
    }
  }
  
  export function decoderequestRoomListC2S(binary: Uint8Array): requestRoomListC2S {
    return _decoderequestRoomListC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestRoomListC2S(bb: ByteBuffer): requestRoomListC2S {
    let message: requestRoomListC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mGameID = 1;
        case 1: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mGameType = 2;
        case 2: {
          message.mGameType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mGameType === undefined)
      throw new Error("Missing required field: mGameType");
  
    return message;
  }
  
  export interface requestRoomListS2C {
    mResult: number;
    mGameID: number;
    mRoomList?: roomInfo[];
    mGameType: number;
  }
  
  export function encoderequestRoomListS2C(message: requestRoomListS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRoomListS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRoomListS2C(message: requestRoomListS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mGameID = 2;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // repeated roomInfo mRoomList = 3;
    let array$mRoomList = message.mRoomList;
    if (array$mRoomList !== undefined) {
      for (let value of array$mRoomList) {
        writeVarint32(bb, 26);
        let nested = popByteBuffer();
        _encoderoomInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  
    // required int32 mGameType = 4;
    let $mGameType = message.mGameType;
    if ($mGameType !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mGameType));
    }
  }
  
  export function decoderequestRoomListS2C(binary: Uint8Array): requestRoomListS2C {
    return _decoderequestRoomListS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestRoomListS2C(bb: ByteBuffer): requestRoomListS2C {
    let message: requestRoomListS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mGameID = 2;
        case 2: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // repeated roomInfo mRoomList = 3;
        case 3: {
          let limit = pushTemporaryLength(bb);
          let values = message.mRoomList || (message.mRoomList = []);
          values.push(_decoderoomInfo(bb));
          bb.limit = limit;
          break;
        }
  
        // required int32 mGameType = 4;
        case 4: {
          message.mGameType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mGameType === undefined)
      throw new Error("Missing required field: mGameType");
  
    return message;
  }
  
  export interface roomInfo {
    mRoomID: number;
    mRoomType: number;
    mLessMoney: Long;
    mOddsMin?: number;
    mRoomName?: string;
  }
  
  export function encoderoomInfo(message: roomInfo): Uint8Array {
    let bb = popByteBuffer();
    _encoderoomInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderoomInfo(message: roomInfo, bb: ByteBuffer): void {
    // required int32 mRoomID = 1;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mRoomType = 2;
    let $mRoomType = message.mRoomType;
    if ($mRoomType !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRoomType));
    }
  
    // required int64 mLessMoney = 3;
    let $mLessMoney = message.mLessMoney;
    if ($mLessMoney !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, $mLessMoney);
    }
  
    // optional int32 mOddsMin = 4;
    let $mOddsMin = message.mOddsMin;
    if ($mOddsMin !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mOddsMin));
    }
  
    // optional string mRoomName = 5;
    let $mRoomName = message.mRoomName;
    if ($mRoomName !== undefined) {
      writeVarint32(bb, 42);
      writeString(bb, $mRoomName);
    }
  }
  
  export function decoderoomInfo(binary: Uint8Array): roomInfo {
    return _decoderoomInfo(wrapByteBuffer(binary));
  }
  
  function _decoderoomInfo(bb: ByteBuffer): roomInfo {
    let message: roomInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mRoomID = 1;
        case 1: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomType = 2;
        case 2: {
          message.mRoomType = readVarint32(bb);
          break;
        }
  
        // required int64 mLessMoney = 3;
        case 3: {
          message.mLessMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // optional int32 mOddsMin = 4;
        case 4: {
          message.mOddsMin = readVarint32(bb);
          break;
        }
  
        // optional string mRoomName = 5;
        case 5: {
          message.mRoomName = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mRoomType === undefined)
      throw new Error("Missing required field: mRoomType");
  
    if (message.mLessMoney === undefined)
      throw new Error("Missing required field: mLessMoney");
  
    return message;
  }
  
  export interface requestRoomInfoC2S {
    mGameID: number;
    mRoomID: number;
    mGameType: number;
  }
  
  export function encoderequestRoomInfoC2S(message: requestRoomInfoC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRoomInfoC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRoomInfoC2S(message: requestRoomInfoC2S, bb: ByteBuffer): void {
    // required int32 mGameID = 1;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 2;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mGameType = 3;
    let $mGameType = message.mGameType;
    if ($mGameType !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mGameType));
    }
  }
  
  export function decoderequestRoomInfoC2S(binary: Uint8Array): requestRoomInfoC2S {
    return _decoderequestRoomInfoC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestRoomInfoC2S(bb: ByteBuffer): requestRoomInfoC2S {
    let message: requestRoomInfoC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mGameID = 1;
        case 1: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 2;
        case 2: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mGameType = 3;
        case 3: {
          message.mGameType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mGameType === undefined)
      throw new Error("Missing required field: mGameType");
  
    return message;
  }
  
  export interface playerSeatInfo {
    mDeskIndex: number;
    mSeatIndex: number;
    mPlayerInfo: playerInfo;
  }
  
  export function encodeplayerSeatInfo(message: playerSeatInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeplayerSeatInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeplayerSeatInfo(message: playerSeatInfo, bb: ByteBuffer): void {
    // required int32 mDeskIndex = 1;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // required int32 mSeatIndex = 2;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  
    // required playerInfo mPlayerInfo = 3;
    let $mPlayerInfo = message.mPlayerInfo;
    if ($mPlayerInfo !== undefined) {
      writeVarint32(bb, 26);
      let nested = popByteBuffer();
      _encodeplayerInfo($mPlayerInfo, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decodeplayerSeatInfo(binary: Uint8Array): playerSeatInfo {
    return _decodeplayerSeatInfo(wrapByteBuffer(binary));
  }
  
  function _decodeplayerSeatInfo(bb: ByteBuffer): playerSeatInfo {
    let message: playerSeatInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mDeskIndex = 1;
        case 1: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 2;
        case 2: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        // required playerInfo mPlayerInfo = 3;
        case 3: {
          let limit = pushTemporaryLength(bb);
          message.mPlayerInfo = _decodeplayerInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    if (message.mPlayerInfo === undefined)
      throw new Error("Missing required field: mPlayerInfo");
  
    return message;
  }
  
  export interface requestRoomInfoS2C {
    mResult: number;
    mGameID: number;
    mRoomID: number;
    mDeskCount: number;
    mSeatCount: number;
    mPlayerList?: playerSeatInfo[];
    mRoomType: number;
    mGameType: number;
  }
  
  export function encoderequestRoomInfoS2C(message: requestRoomInfoS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRoomInfoS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRoomInfoS2C(message: requestRoomInfoS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mGameID = 2;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 3;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskCount = 4;
    let $mDeskCount = message.mDeskCount;
    if ($mDeskCount !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mDeskCount));
    }
  
    // required int32 mSeatCount = 5;
    let $mSeatCount = message.mSeatCount;
    if ($mSeatCount !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mSeatCount));
    }
  
    // repeated playerSeatInfo mPlayerList = 6;
    let array$mPlayerList = message.mPlayerList;
    if (array$mPlayerList !== undefined) {
      for (let value of array$mPlayerList) {
        writeVarint32(bb, 50);
        let nested = popByteBuffer();
        _encodeplayerSeatInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  
    // required int32 mRoomType = 7;
    let $mRoomType = message.mRoomType;
    if ($mRoomType !== undefined) {
      writeVarint32(bb, 56);
      writeVarint64(bb, intToLong($mRoomType));
    }
  
    // required int32 mGameType = 8;
    let $mGameType = message.mGameType;
    if ($mGameType !== undefined) {
      writeVarint32(bb, 64);
      writeVarint64(bb, intToLong($mGameType));
    }
  }
  
  export function decoderequestRoomInfoS2C(binary: Uint8Array): requestRoomInfoS2C {
    return _decoderequestRoomInfoS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestRoomInfoS2C(bb: ByteBuffer): requestRoomInfoS2C {
    let message: requestRoomInfoS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mGameID = 2;
        case 2: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 3;
        case 3: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskCount = 4;
        case 4: {
          message.mDeskCount = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatCount = 5;
        case 5: {
          message.mSeatCount = readVarint32(bb);
          break;
        }
  
        // repeated playerSeatInfo mPlayerList = 6;
        case 6: {
          let limit = pushTemporaryLength(bb);
          let values = message.mPlayerList || (message.mPlayerList = []);
          values.push(_decodeplayerSeatInfo(bb));
          bb.limit = limit;
          break;
        }
  
        // required int32 mRoomType = 7;
        case 7: {
          message.mRoomType = readVarint32(bb);
          break;
        }
  
        // required int32 mGameType = 8;
        case 8: {
          message.mGameType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskCount === undefined)
      throw new Error("Missing required field: mDeskCount");
  
    if (message.mSeatCount === undefined)
      throw new Error("Missing required field: mSeatCount");
  
    if (message.mRoomType === undefined)
      throw new Error("Missing required field: mRoomType");
  
    if (message.mGameType === undefined)
      throw new Error("Missing required field: mGameType");
  
    return message;
  }
  
  export interface pushPlayerSeatDownS2C {
    mGameID: number;
    mRoomID: number;
    mDeskIndex: number;
    mSeatIndex: number;
    mPlayerInfo: playerInfo;
  }
  
  export function encodepushPlayerSeatDownS2C(message: pushPlayerSeatDownS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushPlayerSeatDownS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushPlayerSeatDownS2C(message: pushPlayerSeatDownS2C, bb: ByteBuffer): void {
    // required int32 mGameID = 1;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 2;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskIndex = 3;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // required int32 mSeatIndex = 4;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  
    // required playerInfo mPlayerInfo = 5;
    let $mPlayerInfo = message.mPlayerInfo;
    if ($mPlayerInfo !== undefined) {
      writeVarint32(bb, 42);
      let nested = popByteBuffer();
      _encodeplayerInfo($mPlayerInfo, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decodepushPlayerSeatDownS2C(binary: Uint8Array): pushPlayerSeatDownS2C {
    return _decodepushPlayerSeatDownS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushPlayerSeatDownS2C(bb: ByteBuffer): pushPlayerSeatDownS2C {
    let message: pushPlayerSeatDownS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mGameID = 1;
        case 1: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 2;
        case 2: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskIndex = 3;
        case 3: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 4;
        case 4: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        // required playerInfo mPlayerInfo = 5;
        case 5: {
          let limit = pushTemporaryLength(bb);
          message.mPlayerInfo = _decodeplayerInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    if (message.mPlayerInfo === undefined)
      throw new Error("Missing required field: mPlayerInfo");
  
    return message;
  }
  
  export interface pushPlayerSeatUpS2C {
    mGameID: number;
    mRoomID: number;
    mDeskIndex: number;
    mSeatIndex: number;
  }
  
  export function encodepushPlayerSeatUpS2C(message: pushPlayerSeatUpS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushPlayerSeatUpS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushPlayerSeatUpS2C(message: pushPlayerSeatUpS2C, bb: ByteBuffer): void {
    // required int32 mGameID = 1;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 2;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskIndex = 3;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // required int32 mSeatIndex = 4;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  }
  
  export function decodepushPlayerSeatUpS2C(binary: Uint8Array): pushPlayerSeatUpS2C {
    return _decodepushPlayerSeatUpS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushPlayerSeatUpS2C(bb: ByteBuffer): pushPlayerSeatUpS2C {
    let message: pushPlayerSeatUpS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mGameID = 1;
        case 1: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 2;
        case 2: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskIndex = 3;
        case 3: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 4;
        case 4: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    return message;
  }
  
  export interface requestEnterGameC2S {
    mGameID: number;
    mRoomID: number;
    mDeskIndex: number;
    mSeatIndex: number;
    mGameType: number;
    mRenew: number;
  }
  
  export function encoderequestEnterGameC2S(message: requestEnterGameC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestEnterGameC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestEnterGameC2S(message: requestEnterGameC2S, bb: ByteBuffer): void {
    // required int32 mGameID = 1;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 2;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskIndex = 3;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // required int32 mSeatIndex = 4;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  
    // required int32 mGameType = 5;
    let $mGameType = message.mGameType;
    if ($mGameType !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mGameType));
    }
  
    // required int32 mRenew = 6;
    let $mRenew = message.mRenew;
    if ($mRenew !== undefined) {
      writeVarint32(bb, 48);
      writeVarint64(bb, intToLong($mRenew));
    }
  }
  
  export function decoderequestEnterGameC2S(binary: Uint8Array): requestEnterGameC2S {
    return _decoderequestEnterGameC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestEnterGameC2S(bb: ByteBuffer): requestEnterGameC2S {
    let message: requestEnterGameC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mGameID = 1;
        case 1: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 2;
        case 2: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskIndex = 3;
        case 3: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 4;
        case 4: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mGameType = 5;
        case 5: {
          message.mGameType = readVarint32(bb);
          break;
        }
  
        // required int32 mRenew = 6;
        case 6: {
          message.mRenew = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    if (message.mGameType === undefined)
      throw new Error("Missing required field: mGameType");
  
    if (message.mRenew === undefined)
      throw new Error("Missing required field: mRenew");
  
    return message;
  }
  
  export interface requestEnterGameS2C {
    mResult: number;
    mGameID: number;
    mRoomID: number;
    mDeskIndex: number;
    mSeatIndex: number;
    mGameType: number;
    mRenew: number;
  }
  
  export function encoderequestEnterGameS2C(message: requestEnterGameS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestEnterGameS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestEnterGameS2C(message: requestEnterGameS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mGameID = 2;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 3;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskIndex = 4;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // required int32 mSeatIndex = 5;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  
    // required int32 mGameType = 6;
    let $mGameType = message.mGameType;
    if ($mGameType !== undefined) {
      writeVarint32(bb, 48);
      writeVarint64(bb, intToLong($mGameType));
    }
  
    // required int32 mRenew = 7;
    let $mRenew = message.mRenew;
    if ($mRenew !== undefined) {
      writeVarint32(bb, 56);
      writeVarint64(bb, intToLong($mRenew));
    }
  }
  
  export function decoderequestEnterGameS2C(binary: Uint8Array): requestEnterGameS2C {
    return _decoderequestEnterGameS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestEnterGameS2C(bb: ByteBuffer): requestEnterGameS2C {
    let message: requestEnterGameS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mGameID = 2;
        case 2: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 3;
        case 3: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskIndex = 4;
        case 4: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 5;
        case 5: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mGameType = 6;
        case 6: {
          message.mGameType = readVarint32(bb);
          break;
        }
  
        // required int32 mRenew = 7;
        case 7: {
          message.mRenew = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    if (message.mGameType === undefined)
      throw new Error("Missing required field: mGameType");
  
    if (message.mRenew === undefined)
      throw new Error("Missing required field: mRenew");
  
    return message;
  }
  
  export interface requestLeaveGameC2S {
  }
  
  export function encoderequestLeaveGameC2S(message: requestLeaveGameC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestLeaveGameC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestLeaveGameC2S(message: requestLeaveGameC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestLeaveGameC2S(binary: Uint8Array): requestLeaveGameC2S {
    return _decoderequestLeaveGameC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestLeaveGameC2S(bb: ByteBuffer): requestLeaveGameC2S {
    let message: requestLeaveGameC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestLeaveGameS2C {
    mResult: number;
  }
  
  export function encoderequestLeaveGameS2C(message: requestLeaveGameS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestLeaveGameS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestLeaveGameS2C(message: requestLeaveGameS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decoderequestLeaveGameS2C(binary: Uint8Array): requestLeaveGameS2C {
    return _decoderequestLeaveGameS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestLeaveGameS2C(bb: ByteBuffer): requestLeaveGameS2C {
    let message: requestLeaveGameS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface seatPlayMoney {
    mUserID: number;
    mSeatIndex: number;
    mMoney: Long;
  }
  
  export function encodeseatPlayMoney(message: seatPlayMoney): Uint8Array {
    let bb = popByteBuffer();
    _encodeseatPlayMoney(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeseatPlayMoney(message: seatPlayMoney, bb: ByteBuffer): void {
    // required int32 mUserID = 1;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mUserID));
    }
  
    // required int32 mSeatIndex = 2;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  
    // required int64 mMoney = 3;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, $mMoney);
    }
  }
  
  export function decodeseatPlayMoney(binary: Uint8Array): seatPlayMoney {
    return _decodeseatPlayMoney(wrapByteBuffer(binary));
  }
  
  function _decodeseatPlayMoney(bb: ByteBuffer): seatPlayMoney {
    let message: seatPlayMoney = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mUserID = 1;
        case 1: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 2;
        case 2: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        // required int64 mMoney = 3;
        case 3: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    return message;
  }
  
  export interface pushDeskPlayerMoneyS2C {
    mGameID: number;
    mRoomID: number;
    mDeskIndex: number;
    mPlayerList?: seatPlayMoney[];
  }
  
  export function encodepushDeskPlayerMoneyS2C(message: pushDeskPlayerMoneyS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushDeskPlayerMoneyS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushDeskPlayerMoneyS2C(message: pushDeskPlayerMoneyS2C, bb: ByteBuffer): void {
    // required int32 mGameID = 1;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 2;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskIndex = 3;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // repeated seatPlayMoney mPlayerList = 4;
    let array$mPlayerList = message.mPlayerList;
    if (array$mPlayerList !== undefined) {
      for (let value of array$mPlayerList) {
        writeVarint32(bb, 34);
        let nested = popByteBuffer();
        _encodeseatPlayMoney(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decodepushDeskPlayerMoneyS2C(binary: Uint8Array): pushDeskPlayerMoneyS2C {
    return _decodepushDeskPlayerMoneyS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushDeskPlayerMoneyS2C(bb: ByteBuffer): pushDeskPlayerMoneyS2C {
    let message: pushDeskPlayerMoneyS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mGameID = 1;
        case 1: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 2;
        case 2: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskIndex = 3;
        case 3: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // repeated seatPlayMoney mPlayerList = 4;
        case 4: {
          let limit = pushTemporaryLength(bb);
          let values = message.mPlayerList || (message.mPlayerList = []);
          values.push(_decodeseatPlayMoney(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    return message;
  }
  
  export interface requestRoomBackToHallC2S {
  }
  
  export function encoderequestRoomBackToHallC2S(message: requestRoomBackToHallC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRoomBackToHallC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRoomBackToHallC2S(message: requestRoomBackToHallC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestRoomBackToHallC2S(binary: Uint8Array): requestRoomBackToHallC2S {
    return _decoderequestRoomBackToHallC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestRoomBackToHallC2S(bb: ByteBuffer): requestRoomBackToHallC2S {
    let message: requestRoomBackToHallC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestRoomBackToHallS2C {
    mResult: number;
  }
  
  export function encoderequestRoomBackToHallS2C(message: requestRoomBackToHallS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRoomBackToHallS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRoomBackToHallS2C(message: requestRoomBackToHallS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decoderequestRoomBackToHallS2C(binary: Uint8Array): requestRoomBackToHallS2C {
    return _decoderequestRoomBackToHallS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestRoomBackToHallS2C(bb: ByteBuffer): requestRoomBackToHallS2C {
    let message: requestRoomBackToHallS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface requestPayDataC2S {
  }
  
  export function encoderequestPayDataC2S(message: requestPayDataC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPayDataC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPayDataC2S(message: requestPayDataC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestPayDataC2S(binary: Uint8Array): requestPayDataC2S {
    return _decoderequestPayDataC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestPayDataC2S(bb: ByteBuffer): requestPayDataC2S {
    let message: requestPayDataC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface payData {
    mID: number;
    mGold: number;
    mMoney: number;
    mDesc?: string;
    mGiveRate: number;
  }
  
  export function encodepayData(message: payData): Uint8Array {
    let bb = popByteBuffer();
    _encodepayData(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepayData(message: payData, bb: ByteBuffer): void {
    // required int32 mID = 1;
    let $mID = message.mID;
    if ($mID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mID));
    }
  
    // required int32 mGold = 2;
    let $mGold = message.mGold;
    if ($mGold !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mGold));
    }
  
    // required int32 mMoney = 3;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mMoney));
    }
  
    // optional string mDesc = 4;
    let $mDesc = message.mDesc;
    if ($mDesc !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mDesc);
    }
  
    // required int32 mGiveRate = 5;
    let $mGiveRate = message.mGiveRate;
    if ($mGiveRate !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mGiveRate));
    }
  }
  
  export function decodepayData(binary: Uint8Array): payData {
    return _decodepayData(wrapByteBuffer(binary));
  }
  
  function _decodepayData(bb: ByteBuffer): payData {
    let message: payData = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mID = 1;
        case 1: {
          message.mID = readVarint32(bb);
          break;
        }
  
        // required int32 mGold = 2;
        case 2: {
          message.mGold = readVarint32(bb);
          break;
        }
  
        // required int32 mMoney = 3;
        case 3: {
          message.mMoney = readVarint32(bb);
          break;
        }
  
        // optional string mDesc = 4;
        case 4: {
          message.mDesc = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mGiveRate = 5;
        case 5: {
          message.mGiveRate = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mID === undefined)
      throw new Error("Missing required field: mID");
  
    if (message.mGold === undefined)
      throw new Error("Missing required field: mGold");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mGiveRate === undefined)
      throw new Error("Missing required field: mGiveRate");
  
    return message;
  }
  
  export interface daiLiData {
    mNickName: string;
    mWechat: string;
    mQQ: string;
    mAgentID: number;
    mPayTypeList?: number[];
    mHello: string;
    mHeadIndex: number;
  }
  
  export function encodedaiLiData(message: daiLiData): Uint8Array {
    let bb = popByteBuffer();
    _encodedaiLiData(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodedaiLiData(message: daiLiData, bb: ByteBuffer): void {
    // required string mNickName = 1;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mNickName);
    }
  
    // required string mWechat = 2;
    let $mWechat = message.mWechat;
    if ($mWechat !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mWechat);
    }
  
    // required string mQQ = 3;
    let $mQQ = message.mQQ;
    if ($mQQ !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mQQ);
    }
  
    // required int32 mAgentID = 4;
    let $mAgentID = message.mAgentID;
    if ($mAgentID !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mAgentID));
    }
  
    // repeated int32 mPayTypeList = 5;
    let array$mPayTypeList = message.mPayTypeList;
    if (array$mPayTypeList !== undefined) {
      let packed = popByteBuffer();
      for (let value of array$mPayTypeList) {
        writeVarint64(packed, intToLong(value));
      }
      writeVarint32(bb, 42);
      writeVarint32(bb, packed.offset);
      writeByteBuffer(bb, packed);
      pushByteBuffer(packed);
    }
  
    // required string mHello = 6;
    let $mHello = message.mHello;
    if ($mHello !== undefined) {
      writeVarint32(bb, 50);
      writeString(bb, $mHello);
    }
  
    // required int32 mHeadIndex = 7;
    let $mHeadIndex = message.mHeadIndex;
    if ($mHeadIndex !== undefined) {
      writeVarint32(bb, 56);
      writeVarint64(bb, intToLong($mHeadIndex));
    }
  }
  
  export function decodedaiLiData(binary: Uint8Array): daiLiData {
    return _decodedaiLiData(wrapByteBuffer(binary));
  }
  
  function _decodedaiLiData(bb: ByteBuffer): daiLiData {
    let message: daiLiData = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mNickName = 1;
        case 1: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mWechat = 2;
        case 2: {
          message.mWechat = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mQQ = 3;
        case 3: {
          message.mQQ = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mAgentID = 4;
        case 4: {
          message.mAgentID = readVarint32(bb);
          break;
        }
  
        // repeated int32 mPayTypeList = 5;
        case 5: {
          let values = message.mPayTypeList || (message.mPayTypeList = []);
          if ((tag & 7) === 2) {
            let outerLimit = pushTemporaryLength(bb);
            while (!isAtEnd(bb)) {
              values.push(readVarint32(bb));
            }
            bb.limit = outerLimit;
          } else {
            values.push(readVarint32(bb));
          }
          break;
        }
  
        // required string mHello = 6;
        case 6: {
          message.mHello = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mHeadIndex = 7;
        case 7: {
          message.mHeadIndex = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    if (message.mWechat === undefined)
      throw new Error("Missing required field: mWechat");
  
    if (message.mQQ === undefined)
      throw new Error("Missing required field: mQQ");
  
    if (message.mAgentID === undefined)
      throw new Error("Missing required field: mAgentID");
  
    if (message.mHello === undefined)
      throw new Error("Missing required field: mHello");
  
    if (message.mHeadIndex === undefined)
      throw new Error("Missing required field: mHeadIndex");
  
    return message;
  }
  
  export interface bankData {
    mMoneyList?: number[];
    mBankName: string;
    mBankAccount: string;
    mBankOwner: string;
    mBankNoteCode: string;
    mBankBranch: string;
  }
  
  export function encodebankData(message: bankData): Uint8Array {
    let bb = popByteBuffer();
    _encodebankData(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebankData(message: bankData, bb: ByteBuffer): void {
    // repeated int32 mMoneyList = 1;
    let array$mMoneyList = message.mMoneyList;
    if (array$mMoneyList !== undefined) {
      let packed = popByteBuffer();
      for (let value of array$mMoneyList) {
        writeVarint64(packed, intToLong(value));
      }
      writeVarint32(bb, 10);
      writeVarint32(bb, packed.offset);
      writeByteBuffer(bb, packed);
      pushByteBuffer(packed);
    }
  
    // required string mBankName = 2;
    let $mBankName = message.mBankName;
    if ($mBankName !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mBankName);
    }
  
    // required string mBankAccount = 3;
    let $mBankAccount = message.mBankAccount;
    if ($mBankAccount !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mBankAccount);
    }
  
    // required string mBankOwner = 4;
    let $mBankOwner = message.mBankOwner;
    if ($mBankOwner !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mBankOwner);
    }
  
    // required string mBankNoteCode = 5;
    let $mBankNoteCode = message.mBankNoteCode;
    if ($mBankNoteCode !== undefined) {
      writeVarint32(bb, 42);
      writeString(bb, $mBankNoteCode);
    }
  
    // required string mBankBranch = 6;
    let $mBankBranch = message.mBankBranch;
    if ($mBankBranch !== undefined) {
      writeVarint32(bb, 50);
      writeString(bb, $mBankBranch);
    }
  }
  
  export function decodebankData(binary: Uint8Array): bankData {
    return _decodebankData(wrapByteBuffer(binary));
  }
  
  function _decodebankData(bb: ByteBuffer): bankData {
    let message: bankData = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated int32 mMoneyList = 1;
        case 1: {
          let values = message.mMoneyList || (message.mMoneyList = []);
          if ((tag & 7) === 2) {
            let outerLimit = pushTemporaryLength(bb);
            while (!isAtEnd(bb)) {
              values.push(readVarint32(bb));
            }
            bb.limit = outerLimit;
          } else {
            values.push(readVarint32(bb));
          }
          break;
        }
  
        // required string mBankName = 2;
        case 2: {
          message.mBankName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankAccount = 3;
        case 3: {
          message.mBankAccount = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankOwner = 4;
        case 4: {
          message.mBankOwner = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankNoteCode = 5;
        case 5: {
          message.mBankNoteCode = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankBranch = 6;
        case 6: {
          message.mBankBranch = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mBankName === undefined)
      throw new Error("Missing required field: mBankName");
  
    if (message.mBankAccount === undefined)
      throw new Error("Missing required field: mBankAccount");
  
    if (message.mBankOwner === undefined)
      throw new Error("Missing required field: mBankOwner");
  
    if (message.mBankNoteCode === undefined)
      throw new Error("Missing required field: mBankNoteCode");
  
    if (message.mBankBranch === undefined)
      throw new Error("Missing required field: mBankBranch");
  
    return message;
  }
  
  export interface requestPayDataS2C {
    mPayDataList?: payData[];
    mDaiLiDataList?: daiLiData[];
    mExternGold: number;
    mBankData?: bankData;
    mShieldWords?: string[];
  }
  
  export function encoderequestPayDataS2C(message: requestPayDataS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPayDataS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPayDataS2C(message: requestPayDataS2C, bb: ByteBuffer): void {
    // repeated payData mPayDataList = 1;
    let array$mPayDataList = message.mPayDataList;
    if (array$mPayDataList !== undefined) {
      for (let value of array$mPayDataList) {
        writeVarint32(bb, 10);
        let nested = popByteBuffer();
        _encodepayData(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  
    // repeated daiLiData mDaiLiDataList = 2;
    let array$mDaiLiDataList = message.mDaiLiDataList;
    if (array$mDaiLiDataList !== undefined) {
      for (let value of array$mDaiLiDataList) {
        writeVarint32(bb, 18);
        let nested = popByteBuffer();
        _encodedaiLiData(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  
    // required int32 mExternGold = 3;
    let $mExternGold = message.mExternGold;
    if ($mExternGold !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mExternGold));
    }
  
    // optional bankData mBankData = 4;
    let $mBankData = message.mBankData;
    if ($mBankData !== undefined) {
      writeVarint32(bb, 34);
      let nested = popByteBuffer();
      _encodebankData($mBankData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  
    // repeated string mShieldWords = 5;
    let array$mShieldWords = message.mShieldWords;
    if (array$mShieldWords !== undefined) {
      for (let value of array$mShieldWords) {
        writeVarint32(bb, 42);
        writeString(bb, value);
      }
    }
  }
  
  export function decoderequestPayDataS2C(binary: Uint8Array): requestPayDataS2C {
    return _decoderequestPayDataS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestPayDataS2C(bb: ByteBuffer): requestPayDataS2C {
    let message: requestPayDataS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated payData mPayDataList = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          let values = message.mPayDataList || (message.mPayDataList = []);
          values.push(_decodepayData(bb));
          bb.limit = limit;
          break;
        }
  
        // repeated daiLiData mDaiLiDataList = 2;
        case 2: {
          let limit = pushTemporaryLength(bb);
          let values = message.mDaiLiDataList || (message.mDaiLiDataList = []);
          values.push(_decodedaiLiData(bb));
          bb.limit = limit;
          break;
        }
  
        // required int32 mExternGold = 3;
        case 3: {
          message.mExternGold = readVarint32(bb);
          break;
        }
  
        // optional bankData mBankData = 4;
        case 4: {
          let limit = pushTemporaryLength(bb);
          message.mBankData = _decodebankData(bb);
          bb.limit = limit;
          break;
        }
  
        // repeated string mShieldWords = 5;
        case 5: {
          let values = message.mShieldWords || (message.mShieldWords = []);
          values.push(readString(bb, readVarint32(bb)));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mExternGold === undefined)
      throw new Error("Missing required field: mExternGold");
  
    return message;
  }
  
  export interface requestPayOrderC2S {
    mID: number;
    mManual?: number;
  }
  
  export function encoderequestPayOrderC2S(message: requestPayOrderC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPayOrderC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPayOrderC2S(message: requestPayOrderC2S, bb: ByteBuffer): void {
    // required int32 mID = 1;
    let $mID = message.mID;
    if ($mID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mID));
    }
  
    // optional int32 mManual = 2;
    let $mManual = message.mManual;
    if ($mManual !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mManual));
    }
  }
  
  export function decoderequestPayOrderC2S(binary: Uint8Array): requestPayOrderC2S {
    return _decoderequestPayOrderC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestPayOrderC2S(bb: ByteBuffer): requestPayOrderC2S {
    let message: requestPayOrderC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mID = 1;
        case 1: {
          message.mID = readVarint32(bb);
          break;
        }
  
        // optional int32 mManual = 2;
        case 2: {
          message.mManual = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mID === undefined)
      throw new Error("Missing required field: mID");
  
    return message;
  }
  
  export interface requestPayOrderS2C {
    mResult: number;
    mPayOrder: string;
    mPayLink: string;
  }
  
  export function encoderequestPayOrderS2C(message: requestPayOrderS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPayOrderS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPayOrderS2C(message: requestPayOrderS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required string mPayOrder = 2;
    let $mPayOrder = message.mPayOrder;
    if ($mPayOrder !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mPayOrder);
    }
  
    // required string mPayLink = 3;
    let $mPayLink = message.mPayLink;
    if ($mPayLink !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mPayLink);
    }
  }
  
  export function decoderequestPayOrderS2C(binary: Uint8Array): requestPayOrderS2C {
    return _decoderequestPayOrderS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestPayOrderS2C(bb: ByteBuffer): requestPayOrderS2C {
    let message: requestPayOrderS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required string mPayOrder = 2;
        case 2: {
          message.mPayOrder = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mPayLink = 3;
        case 3: {
          message.mPayLink = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mPayOrder === undefined)
      throw new Error("Missing required field: mPayOrder");
  
    if (message.mPayLink === undefined)
      throw new Error("Missing required field: mPayLink");
  
    return message;
  }
  
  export interface checkPayOrderC2S {
    mPayOrder: string;
  }
  
  export function encodecheckPayOrderC2S(message: checkPayOrderC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodecheckPayOrderC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodecheckPayOrderC2S(message: checkPayOrderC2S, bb: ByteBuffer): void {
    // required string mPayOrder = 1;
    let $mPayOrder = message.mPayOrder;
    if ($mPayOrder !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mPayOrder);
    }
  }
  
  export function decodecheckPayOrderC2S(binary: Uint8Array): checkPayOrderC2S {
    return _decodecheckPayOrderC2S(wrapByteBuffer(binary));
  }
  
  function _decodecheckPayOrderC2S(bb: ByteBuffer): checkPayOrderC2S {
    let message: checkPayOrderC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mPayOrder = 1;
        case 1: {
          message.mPayOrder = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mPayOrder === undefined)
      throw new Error("Missing required field: mPayOrder");
  
    return message;
  }
  
  export interface checkPayOrderS2C {
    mResult: number;
  }
  
  export function encodecheckPayOrderS2C(message: checkPayOrderS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodecheckPayOrderS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodecheckPayOrderS2C(message: checkPayOrderS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decodecheckPayOrderS2C(binary: Uint8Array): checkPayOrderS2C {
    return _decodecheckPayOrderS2C(wrapByteBuffer(binary));
  }
  
  function _decodecheckPayOrderS2C(bb: ByteBuffer): checkPayOrderS2C {
    let message: checkPayOrderS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface updatePlayerAddress {
    mAddress: string;
  }
  
  export function encodeupdatePlayerAddress(message: updatePlayerAddress): Uint8Array {
    let bb = popByteBuffer();
    _encodeupdatePlayerAddress(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeupdatePlayerAddress(message: updatePlayerAddress, bb: ByteBuffer): void {
    // required string mAddress = 1;
    let $mAddress = message.mAddress;
    if ($mAddress !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mAddress);
    }
  }
  
  export function decodeupdatePlayerAddress(binary: Uint8Array): updatePlayerAddress {
    return _decodeupdatePlayerAddress(wrapByteBuffer(binary));
  }
  
  function _decodeupdatePlayerAddress(bb: ByteBuffer): updatePlayerAddress {
    let message: updatePlayerAddress = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mAddress = 1;
        case 1: {
          message.mAddress = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAddress === undefined)
      throw new Error("Missing required field: mAddress");
  
    return message;
  }
  
  export interface updatePlayerIp {
    mIp: string;
  }
  
  export function encodeupdatePlayerIp(message: updatePlayerIp): Uint8Array {
    let bb = popByteBuffer();
    _encodeupdatePlayerIp(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeupdatePlayerIp(message: updatePlayerIp, bb: ByteBuffer): void {
    // required string mIp = 1;
    let $mIp = message.mIp;
    if ($mIp !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mIp);
    }
  }
  
  export function decodeupdatePlayerIp(binary: Uint8Array): updatePlayerIp {
    return _decodeupdatePlayerIp(wrapByteBuffer(binary));
  }
  
  function _decodeupdatePlayerIp(bb: ByteBuffer): updatePlayerIp {
    let message: updatePlayerIp = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mIp = 1;
        case 1: {
          message.mIp = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mIp === undefined)
      throw new Error("Missing required field: mIp");
  
    return message;
  }
  
  export interface requestAnnouncementC2S {
  }
  
  export function encoderequestAnnouncementC2S(message: requestAnnouncementC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestAnnouncementC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestAnnouncementC2S(message: requestAnnouncementC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestAnnouncementC2S(binary: Uint8Array): requestAnnouncementC2S {
    return _decoderequestAnnouncementC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestAnnouncementC2S(bb: ByteBuffer): requestAnnouncementC2S {
    let message: requestAnnouncementC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestAnnouncementS2C {
    mResult: number;
    mAnnouncements?: announceInfo[];
  }
  
  export function encoderequestAnnouncementS2C(message: requestAnnouncementS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestAnnouncementS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestAnnouncementS2C(message: requestAnnouncementS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // repeated announceInfo mAnnouncements = 2;
    let array$mAnnouncements = message.mAnnouncements;
    if (array$mAnnouncements !== undefined) {
      for (let value of array$mAnnouncements) {
        writeVarint32(bb, 18);
        let nested = popByteBuffer();
        _encodeannounceInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decoderequestAnnouncementS2C(binary: Uint8Array): requestAnnouncementS2C {
    return _decoderequestAnnouncementS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestAnnouncementS2C(bb: ByteBuffer): requestAnnouncementS2C {
    let message: requestAnnouncementS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // repeated announceInfo mAnnouncements = 2;
        case 2: {
          let limit = pushTemporaryLength(bb);
          let values = message.mAnnouncements || (message.mAnnouncements = []);
          values.push(_decodeannounceInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface announceInfo {
    mType: number;
    mTitle: string;
    mContentType: number;
    mContent: string;
    mPanelIndex: number;
    mSlotData?: slotInfo;
  }
  
  export function encodeannounceInfo(message: announceInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeannounceInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeannounceInfo(message: announceInfo, bb: ByteBuffer): void {
    // required int32 mType = 1;
    let $mType = message.mType;
    if ($mType !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mType));
    }
  
    // required string mTitle = 2;
    let $mTitle = message.mTitle;
    if ($mTitle !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mTitle);
    }
  
    // required int32 mContentType = 3;
    let $mContentType = message.mContentType;
    if ($mContentType !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mContentType));
    }
  
    // required string mContent = 4;
    let $mContent = message.mContent;
    if ($mContent !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mContent);
    }
  
    // required int32 mPanelIndex = 5;
    let $mPanelIndex = message.mPanelIndex;
    if ($mPanelIndex !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mPanelIndex));
    }
  
    // optional slotInfo mSlotData = 6;
    let $mSlotData = message.mSlotData;
    if ($mSlotData !== undefined) {
      writeVarint32(bb, 50);
      let nested = popByteBuffer();
      _encodeslotInfo($mSlotData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decodeannounceInfo(binary: Uint8Array): announceInfo {
    return _decodeannounceInfo(wrapByteBuffer(binary));
  }
  
  function _decodeannounceInfo(bb: ByteBuffer): announceInfo {
    let message: announceInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mType = 1;
        case 1: {
          message.mType = readVarint32(bb);
          break;
        }
  
        // required string mTitle = 2;
        case 2: {
          message.mTitle = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mContentType = 3;
        case 3: {
          message.mContentType = readVarint32(bb);
          break;
        }
  
        // required string mContent = 4;
        case 4: {
          message.mContent = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mPanelIndex = 5;
        case 5: {
          message.mPanelIndex = readVarint32(bb);
          break;
        }
  
        // optional slotInfo mSlotData = 6;
        case 6: {
          let limit = pushTemporaryLength(bb);
          message.mSlotData = _decodeslotInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mType === undefined)
      throw new Error("Missing required field: mType");
  
    if (message.mTitle === undefined)
      throw new Error("Missing required field: mTitle");
  
    if (message.mContentType === undefined)
      throw new Error("Missing required field: mContentType");
  
    if (message.mContent === undefined)
      throw new Error("Missing required field: mContent");
  
    if (message.mPanelIndex === undefined)
      throw new Error("Missing required field: mPanelIndex");
  
    return message;
  }
  
  export interface slotInfo {
    mStartTimeStamp: number;
    mEndTimeStamp: number;
    mOnceMoney: number;
    mAllRecharge: number;
    mSlotTimes: number;
    mAwardList?: Long[];
  }
  
  export function encodeslotInfo(message: slotInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeslotInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeslotInfo(message: slotInfo, bb: ByteBuffer): void {
    // required int32 mStartTimeStamp = 1;
    let $mStartTimeStamp = message.mStartTimeStamp;
    if ($mStartTimeStamp !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mStartTimeStamp));
    }
  
    // required int32 mEndTimeStamp = 2;
    let $mEndTimeStamp = message.mEndTimeStamp;
    if ($mEndTimeStamp !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mEndTimeStamp));
    }
  
    // required int32 mOnceMoney = 3;
    let $mOnceMoney = message.mOnceMoney;
    if ($mOnceMoney !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mOnceMoney));
    }
  
    // required int32 mAllRecharge = 4;
    let $mAllRecharge = message.mAllRecharge;
    if ($mAllRecharge !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mAllRecharge));
    }
  
    // required int32 mSlotTimes = 5;
    let $mSlotTimes = message.mSlotTimes;
    if ($mSlotTimes !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mSlotTimes));
    }
  
    // repeated int64 mAwardList = 6;
    let array$mAwardList = message.mAwardList;
    if (array$mAwardList !== undefined) {
      let packed = popByteBuffer();
      for (let value of array$mAwardList) {
        writeVarint64(packed, value);
      }
      writeVarint32(bb, 50);
      writeVarint32(bb, packed.offset);
      writeByteBuffer(bb, packed);
      pushByteBuffer(packed);
    }
  }
  
  export function decodeslotInfo(binary: Uint8Array): slotInfo {
    return _decodeslotInfo(wrapByteBuffer(binary));
  }
  
  function _decodeslotInfo(bb: ByteBuffer): slotInfo {
    let message: slotInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mStartTimeStamp = 1;
        case 1: {
          message.mStartTimeStamp = readVarint32(bb);
          break;
        }
  
        // required int32 mEndTimeStamp = 2;
        case 2: {
          message.mEndTimeStamp = readVarint32(bb);
          break;
        }
  
        // required int32 mOnceMoney = 3;
        case 3: {
          message.mOnceMoney = readVarint32(bb);
          break;
        }
  
        // required int32 mAllRecharge = 4;
        case 4: {
          message.mAllRecharge = readVarint32(bb);
          break;
        }
  
        // required int32 mSlotTimes = 5;
        case 5: {
          message.mSlotTimes = readVarint32(bb);
          break;
        }
  
        // repeated int64 mAwardList = 6;
        case 6: {
          let values = message.mAwardList || (message.mAwardList = []);
          if ((tag & 7) === 2) {
            let outerLimit = pushTemporaryLength(bb);
            while (!isAtEnd(bb)) {
              values.push(readVarint64(bb, /* unsigned */ false));
            }
            bb.limit = outerLimit;
          } else {
            values.push(readVarint64(bb, /* unsigned */ false));
          }
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mStartTimeStamp === undefined)
      throw new Error("Missing required field: mStartTimeStamp");
  
    if (message.mEndTimeStamp === undefined)
      throw new Error("Missing required field: mEndTimeStamp");
  
    if (message.mOnceMoney === undefined)
      throw new Error("Missing required field: mOnceMoney");
  
    if (message.mAllRecharge === undefined)
      throw new Error("Missing required field: mAllRecharge");
  
    if (message.mSlotTimes === undefined)
      throw new Error("Missing required field: mSlotTimes");
  
    return message;
  }
  
  export interface requestPhoneVerifyCodeC2S {
    mPhoneNum: string;
  }
  
  export function encoderequestPhoneVerifyCodeC2S(message: requestPhoneVerifyCodeC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPhoneVerifyCodeC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPhoneVerifyCodeC2S(message: requestPhoneVerifyCodeC2S, bb: ByteBuffer): void {
    // required string mPhoneNum = 1;
    let $mPhoneNum = message.mPhoneNum;
    if ($mPhoneNum !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mPhoneNum);
    }
  }
  
  export function decoderequestPhoneVerifyCodeC2S(binary: Uint8Array): requestPhoneVerifyCodeC2S {
    return _decoderequestPhoneVerifyCodeC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestPhoneVerifyCodeC2S(bb: ByteBuffer): requestPhoneVerifyCodeC2S {
    let message: requestPhoneVerifyCodeC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mPhoneNum = 1;
        case 1: {
          message.mPhoneNum = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mPhoneNum === undefined)
      throw new Error("Missing required field: mPhoneNum");
  
    return message;
  }
  
  export interface requestPhoneVerifyCodeS2C {
    mResult: number;
  }
  
  export function encoderequestPhoneVerifyCodeS2C(message: requestPhoneVerifyCodeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPhoneVerifyCodeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPhoneVerifyCodeS2C(message: requestPhoneVerifyCodeS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decoderequestPhoneVerifyCodeS2C(binary: Uint8Array): requestPhoneVerifyCodeS2C {
    return _decoderequestPhoneVerifyCodeS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestPhoneVerifyCodeS2C(bb: ByteBuffer): requestPhoneVerifyCodeS2C {
    let message: requestPhoneVerifyCodeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface requestTaskListC2S {
  }
  
  export function encoderequestTaskListC2S(message: requestTaskListC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestTaskListC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestTaskListC2S(message: requestTaskListC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestTaskListC2S(binary: Uint8Array): requestTaskListC2S {
    return _decoderequestTaskListC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestTaskListC2S(bb: ByteBuffer): requestTaskListC2S {
    let message: requestTaskListC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestTaskListS2C {
    mTaskList?: taskInfo[];
  }
  
  export function encoderequestTaskListS2C(message: requestTaskListS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestTaskListS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestTaskListS2C(message: requestTaskListS2C, bb: ByteBuffer): void {
    // repeated taskInfo mTaskList = 1;
    let array$mTaskList = message.mTaskList;
    if (array$mTaskList !== undefined) {
      for (let value of array$mTaskList) {
        writeVarint32(bb, 10);
        let nested = popByteBuffer();
        _encodetaskInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decoderequestTaskListS2C(binary: Uint8Array): requestTaskListS2C {
    return _decoderequestTaskListS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestTaskListS2C(bb: ByteBuffer): requestTaskListS2C {
    let message: requestTaskListS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated taskInfo mTaskList = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          let values = message.mTaskList || (message.mTaskList = []);
          values.push(_decodetaskInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface taskInfo {
    mTaskID: number;
    mState: number;
    mMoney: number;
  }
  
  export function encodetaskInfo(message: taskInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodetaskInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodetaskInfo(message: taskInfo, bb: ByteBuffer): void {
    // required int32 mTaskID = 1;
    let $mTaskID = message.mTaskID;
    if ($mTaskID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mTaskID));
    }
  
    // required int32 mState = 2;
    let $mState = message.mState;
    if ($mState !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mState));
    }
  
    // required int32 mMoney = 3;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mMoney));
    }
  }
  
  export function decodetaskInfo(binary: Uint8Array): taskInfo {
    return _decodetaskInfo(wrapByteBuffer(binary));
  }
  
  function _decodetaskInfo(bb: ByteBuffer): taskInfo {
    let message: taskInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mTaskID = 1;
        case 1: {
          message.mTaskID = readVarint32(bb);
          break;
        }
  
        // required int32 mState = 2;
        case 2: {
          message.mState = readVarint32(bb);
          break;
        }
  
        // required int32 mMoney = 3;
        case 3: {
          message.mMoney = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mTaskID === undefined)
      throw new Error("Missing required field: mTaskID");
  
    if (message.mState === undefined)
      throw new Error("Missing required field: mState");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    return message;
  }
  
  export interface shareWechatC2S {
    mShareType: number;
  }
  
  export function encodeshareWechatC2S(message: shareWechatC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodeshareWechatC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeshareWechatC2S(message: shareWechatC2S, bb: ByteBuffer): void {
    // required int32 mShareType = 1;
    let $mShareType = message.mShareType;
    if ($mShareType !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mShareType));
    }
  }
  
  export function decodeshareWechatC2S(binary: Uint8Array): shareWechatC2S {
    return _decodeshareWechatC2S(wrapByteBuffer(binary));
  }
  
  function _decodeshareWechatC2S(bb: ByteBuffer): shareWechatC2S {
    let message: shareWechatC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mShareType = 1;
        case 1: {
          message.mShareType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mShareType === undefined)
      throw new Error("Missing required field: mShareType");
  
    return message;
  }
  
  export interface shareWechatS2C {
    mMoney: number;
  }
  
  export function encodeshareWechatS2C(message: shareWechatS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeshareWechatS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeshareWechatS2C(message: shareWechatS2C, bb: ByteBuffer): void {
    // required int32 mMoney = 1;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mMoney));
    }
  }
  
  export function decodeshareWechatS2C(binary: Uint8Array): shareWechatS2C {
    return _decodeshareWechatS2C(wrapByteBuffer(binary));
  }
  
  function _decodeshareWechatS2C(bb: ByteBuffer): shareWechatS2C {
    let message: shareWechatS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mMoney = 1;
        case 1: {
          message.mMoney = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    return message;
  }
  
  export interface pushNotificationS2C {
    mGameID: number;
    mNotifyID: number;
    mNickName: string;
    mMoney: Long;
  }
  
  export function encodepushNotificationS2C(message: pushNotificationS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushNotificationS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushNotificationS2C(message: pushNotificationS2C, bb: ByteBuffer): void {
    // required int32 mGameID = 1;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mNotifyID = 2;
    let $mNotifyID = message.mNotifyID;
    if ($mNotifyID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mNotifyID));
    }
  
    // required string mNickName = 3;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mNickName);
    }
  
    // required int64 mMoney = 4;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, $mMoney);
    }
  }
  
  export function decodepushNotificationS2C(binary: Uint8Array): pushNotificationS2C {
    return _decodepushNotificationS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushNotificationS2C(bb: ByteBuffer): pushNotificationS2C {
    let message: pushNotificationS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mGameID = 1;
        case 1: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mNotifyID = 2;
        case 2: {
          message.mNotifyID = readVarint32(bb);
          break;
        }
  
        // required string mNickName = 3;
        case 3: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int64 mMoney = 4;
        case 4: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mNotifyID === undefined)
      throw new Error("Missing required field: mNotifyID");
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    return message;
  }
  
  export interface getAchieveAwardC2S {
    mAchieveType: number;
  }
  
  export function encodegetAchieveAwardC2S(message: getAchieveAwardC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodegetAchieveAwardC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodegetAchieveAwardC2S(message: getAchieveAwardC2S, bb: ByteBuffer): void {
    // required int32 mAchieveType = 1;
    let $mAchieveType = message.mAchieveType;
    if ($mAchieveType !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mAchieveType));
    }
  }
  
  export function decodegetAchieveAwardC2S(binary: Uint8Array): getAchieveAwardC2S {
    return _decodegetAchieveAwardC2S(wrapByteBuffer(binary));
  }
  
  function _decodegetAchieveAwardC2S(bb: ByteBuffer): getAchieveAwardC2S {
    let message: getAchieveAwardC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mAchieveType = 1;
        case 1: {
          message.mAchieveType = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAchieveType === undefined)
      throw new Error("Missing required field: mAchieveType");
  
    return message;
  }
  
  export interface getAchieveAwardS2C {
    mResult: number;
    mMoney: Long;
  }
  
  export function encodegetAchieveAwardS2C(message: getAchieveAwardS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodegetAchieveAwardS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodegetAchieveAwardS2C(message: getAchieveAwardS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int64 mMoney = 2;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mMoney);
    }
  }
  
  export function decodegetAchieveAwardS2C(binary: Uint8Array): getAchieveAwardS2C {
    return _decodegetAchieveAwardS2C(wrapByteBuffer(binary));
  }
  
  function _decodegetAchieveAwardS2C(bb: ByteBuffer): getAchieveAwardS2C {
    let message: getAchieveAwardS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int64 mMoney = 2;
        case 2: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    return message;
  }
  
  export interface requestAchieveDataC2S {
  }
  
  export function encoderequestAchieveDataC2S(message: requestAchieveDataC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestAchieveDataC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestAchieveDataC2S(message: requestAchieveDataC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestAchieveDataC2S(binary: Uint8Array): requestAchieveDataC2S {
    return _decoderequestAchieveDataC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestAchieveDataC2S(bb: ByteBuffer): requestAchieveDataC2S {
    let message: requestAchieveDataC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface achieveAwardInfo {
    mRecharge: number;
    mMoney: Long;
    mState: number;
  }
  
  export function encodeachieveAwardInfo(message: achieveAwardInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeachieveAwardInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeachieveAwardInfo(message: achieveAwardInfo, bb: ByteBuffer): void {
    // required int32 mRecharge = 1;
    let $mRecharge = message.mRecharge;
    if ($mRecharge !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mRecharge));
    }
  
    // required int64 mMoney = 2;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mMoney);
    }
  
    // required int32 mState = 3;
    let $mState = message.mState;
    if ($mState !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mState));
    }
  }
  
  export function decodeachieveAwardInfo(binary: Uint8Array): achieveAwardInfo {
    return _decodeachieveAwardInfo(wrapByteBuffer(binary));
  }
  
  function _decodeachieveAwardInfo(bb: ByteBuffer): achieveAwardInfo {
    let message: achieveAwardInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mRecharge = 1;
        case 1: {
          message.mRecharge = readVarint32(bb);
          break;
        }
  
        // required int64 mMoney = 2;
        case 2: {
          message.mMoney = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required int32 mState = 3;
        case 3: {
          message.mState = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mRecharge === undefined)
      throw new Error("Missing required field: mRecharge");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mState === undefined)
      throw new Error("Missing required field: mState");
  
    return message;
  }
  
  export interface achieveInfo {
    mAllRecharge: number;
    mUserID: number;
    mNickName: string;
    mAchieveAwardList?: achieveAwardInfo[];
  }
  
  export function encodeachieveInfo(message: achieveInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeachieveInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeachieveInfo(message: achieveInfo, bb: ByteBuffer): void {
    // required int32 mAllRecharge = 1;
    let $mAllRecharge = message.mAllRecharge;
    if ($mAllRecharge !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mAllRecharge));
    }
  
    // required int32 mUserID = 2;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mUserID));
    }
  
    // required string mNickName = 3;
    let $mNickName = message.mNickName;
    if ($mNickName !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mNickName);
    }
  
    // repeated achieveAwardInfo mAchieveAwardList = 4;
    let array$mAchieveAwardList = message.mAchieveAwardList;
    if (array$mAchieveAwardList !== undefined) {
      for (let value of array$mAchieveAwardList) {
        writeVarint32(bb, 34);
        let nested = popByteBuffer();
        _encodeachieveAwardInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decodeachieveInfo(binary: Uint8Array): achieveInfo {
    return _decodeachieveInfo(wrapByteBuffer(binary));
  }
  
  function _decodeachieveInfo(bb: ByteBuffer): achieveInfo {
    let message: achieveInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mAllRecharge = 1;
        case 1: {
          message.mAllRecharge = readVarint32(bb);
          break;
        }
  
        // required int32 mUserID = 2;
        case 2: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        // required string mNickName = 3;
        case 3: {
          message.mNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // repeated achieveAwardInfo mAchieveAwardList = 4;
        case 4: {
          let limit = pushTemporaryLength(bb);
          let values = message.mAchieveAwardList || (message.mAchieveAwardList = []);
          values.push(_decodeachieveAwardInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAllRecharge === undefined)
      throw new Error("Missing required field: mAllRecharge");
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    if (message.mNickName === undefined)
      throw new Error("Missing required field: mNickName");
  
    return message;
  }
  
  export interface requestAchieveDataS2C {
    mOpenAchieve: number;
    mRecommenderID: number;
    mRecommenderNickName: string;
    mMyAllRecharge: number;
    mMyAchieveAwardList?: achieveAwardInfo[];
    mMyBranches?: achieveInfo[];
  }
  
  export function encoderequestAchieveDataS2C(message: requestAchieveDataS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestAchieveDataS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestAchieveDataS2C(message: requestAchieveDataS2C, bb: ByteBuffer): void {
    // required int32 mOpenAchieve = 1;
    let $mOpenAchieve = message.mOpenAchieve;
    if ($mOpenAchieve !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mOpenAchieve));
    }
  
    // required int32 mRecommenderID = 2;
    let $mRecommenderID = message.mRecommenderID;
    if ($mRecommenderID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRecommenderID));
    }
  
    // required string mRecommenderNickName = 3;
    let $mRecommenderNickName = message.mRecommenderNickName;
    if ($mRecommenderNickName !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mRecommenderNickName);
    }
  
    // required int32 mMyAllRecharge = 4;
    let $mMyAllRecharge = message.mMyAllRecharge;
    if ($mMyAllRecharge !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mMyAllRecharge));
    }
  
    // repeated achieveAwardInfo mMyAchieveAwardList = 5;
    let array$mMyAchieveAwardList = message.mMyAchieveAwardList;
    if (array$mMyAchieveAwardList !== undefined) {
      for (let value of array$mMyAchieveAwardList) {
        writeVarint32(bb, 42);
        let nested = popByteBuffer();
        _encodeachieveAwardInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  
    // repeated achieveInfo mMyBranches = 6;
    let array$mMyBranches = message.mMyBranches;
    if (array$mMyBranches !== undefined) {
      for (let value of array$mMyBranches) {
        writeVarint32(bb, 50);
        let nested = popByteBuffer();
        _encodeachieveInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decoderequestAchieveDataS2C(binary: Uint8Array): requestAchieveDataS2C {
    return _decoderequestAchieveDataS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestAchieveDataS2C(bb: ByteBuffer): requestAchieveDataS2C {
    let message: requestAchieveDataS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mOpenAchieve = 1;
        case 1: {
          message.mOpenAchieve = readVarint32(bb);
          break;
        }
  
        // required int32 mRecommenderID = 2;
        case 2: {
          message.mRecommenderID = readVarint32(bb);
          break;
        }
  
        // required string mRecommenderNickName = 3;
        case 3: {
          message.mRecommenderNickName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mMyAllRecharge = 4;
        case 4: {
          message.mMyAllRecharge = readVarint32(bb);
          break;
        }
  
        // repeated achieveAwardInfo mMyAchieveAwardList = 5;
        case 5: {
          let limit = pushTemporaryLength(bb);
          let values = message.mMyAchieveAwardList || (message.mMyAchieveAwardList = []);
          values.push(_decodeachieveAwardInfo(bb));
          bb.limit = limit;
          break;
        }
  
        // repeated achieveInfo mMyBranches = 6;
        case 6: {
          let limit = pushTemporaryLength(bb);
          let values = message.mMyBranches || (message.mMyBranches = []);
          values.push(_decodeachieveInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mOpenAchieve === undefined)
      throw new Error("Missing required field: mOpenAchieve");
  
    if (message.mRecommenderID === undefined)
      throw new Error("Missing required field: mRecommenderID");
  
    if (message.mRecommenderNickName === undefined)
      throw new Error("Missing required field: mRecommenderNickName");
  
    if (message.mMyAllRecharge === undefined)
      throw new Error("Missing required field: mMyAllRecharge");
  
    return message;
  }
  
  export interface bindRecommenderC2S {
    mUserID: number;
  }
  
  export function encodebindRecommenderC2S(message: bindRecommenderC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodebindRecommenderC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebindRecommenderC2S(message: bindRecommenderC2S, bb: ByteBuffer): void {
    // required int32 mUserID = 1;
    let $mUserID = message.mUserID;
    if ($mUserID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mUserID));
    }
  }
  
  export function decodebindRecommenderC2S(binary: Uint8Array): bindRecommenderC2S {
    return _decodebindRecommenderC2S(wrapByteBuffer(binary));
  }
  
  function _decodebindRecommenderC2S(bb: ByteBuffer): bindRecommenderC2S {
    let message: bindRecommenderC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mUserID = 1;
        case 1: {
          message.mUserID = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mUserID === undefined)
      throw new Error("Missing required field: mUserID");
  
    return message;
  }
  
  export interface bindRecommenderS2C {
    mResult: number;
  }
  
  export function encodebindRecommenderS2C(message: bindRecommenderS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodebindRecommenderS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodebindRecommenderS2C(message: bindRecommenderS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decodebindRecommenderS2C(binary: Uint8Array): bindRecommenderS2C {
    return _decodebindRecommenderS2C(wrapByteBuffer(binary));
  }
  
  function _decodebindRecommenderS2C(bb: ByteBuffer): bindRecommenderS2C {
    let message: bindRecommenderS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface requestChangeDeskC2S {
  }
  
  export function encoderequestChangeDeskC2S(message: requestChangeDeskC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestChangeDeskC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestChangeDeskC2S(message: requestChangeDeskC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestChangeDeskC2S(binary: Uint8Array): requestChangeDeskC2S {
    return _decoderequestChangeDeskC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestChangeDeskC2S(bb: ByteBuffer): requestChangeDeskC2S {
    let message: requestChangeDeskC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestChangeDeskS2C {
    mResult: number;
    mGameID: number;
    mRoomID: number;
    mDeskIndex: number;
    mSeatIndex: number;
  }
  
  export function encoderequestChangeDeskS2C(message: requestChangeDeskS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestChangeDeskS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestChangeDeskS2C(message: requestChangeDeskS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mGameID = 2;
    let $mGameID = message.mGameID;
    if ($mGameID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mGameID));
    }
  
    // required int32 mRoomID = 3;
    let $mRoomID = message.mRoomID;
    if ($mRoomID !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mRoomID));
    }
  
    // required int32 mDeskIndex = 4;
    let $mDeskIndex = message.mDeskIndex;
    if ($mDeskIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mDeskIndex));
    }
  
    // required int32 mSeatIndex = 5;
    let $mSeatIndex = message.mSeatIndex;
    if ($mSeatIndex !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mSeatIndex));
    }
  }
  
  export function decoderequestChangeDeskS2C(binary: Uint8Array): requestChangeDeskS2C {
    return _decoderequestChangeDeskS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestChangeDeskS2C(bb: ByteBuffer): requestChangeDeskS2C {
    let message: requestChangeDeskS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mGameID = 2;
        case 2: {
          message.mGameID = readVarint32(bb);
          break;
        }
  
        // required int32 mRoomID = 3;
        case 3: {
          message.mRoomID = readVarint32(bb);
          break;
        }
  
        // required int32 mDeskIndex = 4;
        case 4: {
          message.mDeskIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mSeatIndex = 5;
        case 5: {
          message.mSeatIndex = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mGameID === undefined)
      throw new Error("Missing required field: mGameID");
  
    if (message.mRoomID === undefined)
      throw new Error("Missing required field: mRoomID");
  
    if (message.mDeskIndex === undefined)
      throw new Error("Missing required field: mDeskIndex");
  
    if (message.mSeatIndex === undefined)
      throw new Error("Missing required field: mSeatIndex");
  
    return message;
  }
  
  export interface requestSubmitBankRechargeC2S {
    mMoney: number;
    mBankName: string;
    mBankAccount: string;
    mBankOwner: string;
    mBankNoteCode: string;
    mBankBranch: string;
    mUserName: string;
    mUserAccount: string;
  }
  
  export function encoderequestSubmitBankRechargeC2S(message: requestSubmitBankRechargeC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestSubmitBankRechargeC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestSubmitBankRechargeC2S(message: requestSubmitBankRechargeC2S, bb: ByteBuffer): void {
    // required int32 mMoney = 1;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mMoney));
    }
  
    // required string mBankName = 2;
    let $mBankName = message.mBankName;
    if ($mBankName !== undefined) {
      writeVarint32(bb, 18);
      writeString(bb, $mBankName);
    }
  
    // required string mBankAccount = 3;
    let $mBankAccount = message.mBankAccount;
    if ($mBankAccount !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mBankAccount);
    }
  
    // required string mBankOwner = 4;
    let $mBankOwner = message.mBankOwner;
    if ($mBankOwner !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mBankOwner);
    }
  
    // required string mBankNoteCode = 5;
    let $mBankNoteCode = message.mBankNoteCode;
    if ($mBankNoteCode !== undefined) {
      writeVarint32(bb, 42);
      writeString(bb, $mBankNoteCode);
    }
  
    // required string mBankBranch = 6;
    let $mBankBranch = message.mBankBranch;
    if ($mBankBranch !== undefined) {
      writeVarint32(bb, 50);
      writeString(bb, $mBankBranch);
    }
  
    // required string mUserName = 7;
    let $mUserName = message.mUserName;
    if ($mUserName !== undefined) {
      writeVarint32(bb, 58);
      writeString(bb, $mUserName);
    }
  
    // required string mUserAccount = 8;
    let $mUserAccount = message.mUserAccount;
    if ($mUserAccount !== undefined) {
      writeVarint32(bb, 66);
      writeString(bb, $mUserAccount);
    }
  }
  
  export function decoderequestSubmitBankRechargeC2S(binary: Uint8Array): requestSubmitBankRechargeC2S {
    return _decoderequestSubmitBankRechargeC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestSubmitBankRechargeC2S(bb: ByteBuffer): requestSubmitBankRechargeC2S {
    let message: requestSubmitBankRechargeC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mMoney = 1;
        case 1: {
          message.mMoney = readVarint32(bb);
          break;
        }
  
        // required string mBankName = 2;
        case 2: {
          message.mBankName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankAccount = 3;
        case 3: {
          message.mBankAccount = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankOwner = 4;
        case 4: {
          message.mBankOwner = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankNoteCode = 5;
        case 5: {
          message.mBankNoteCode = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mBankBranch = 6;
        case 6: {
          message.mBankBranch = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mUserName = 7;
        case 7: {
          message.mUserName = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mUserAccount = 8;
        case 8: {
          message.mUserAccount = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    if (message.mBankName === undefined)
      throw new Error("Missing required field: mBankName");
  
    if (message.mBankAccount === undefined)
      throw new Error("Missing required field: mBankAccount");
  
    if (message.mBankOwner === undefined)
      throw new Error("Missing required field: mBankOwner");
  
    if (message.mBankNoteCode === undefined)
      throw new Error("Missing required field: mBankNoteCode");
  
    if (message.mBankBranch === undefined)
      throw new Error("Missing required field: mBankBranch");
  
    if (message.mUserName === undefined)
      throw new Error("Missing required field: mUserName");
  
    if (message.mUserAccount === undefined)
      throw new Error("Missing required field: mUserAccount");
  
    return message;
  }
  
  export interface requestSubmitBankRechargeS2C {
    mResult: number;
  }
  
  export function encoderequestSubmitBankRechargeS2C(message: requestSubmitBankRechargeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestSubmitBankRechargeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestSubmitBankRechargeS2C(message: requestSubmitBankRechargeS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decoderequestSubmitBankRechargeS2C(binary: Uint8Array): requestSubmitBankRechargeS2C {
    return _decoderequestSubmitBankRechargeS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestSubmitBankRechargeS2C(bb: ByteBuffer): requestSubmitBankRechargeS2C {
    let message: requestSubmitBankRechargeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface requestCollectWebAwardC2S {
    mAwardCode: string;
  }
  
  export function encoderequestCollectWebAwardC2S(message: requestCollectWebAwardC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestCollectWebAwardC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestCollectWebAwardC2S(message: requestCollectWebAwardC2S, bb: ByteBuffer): void {
    // required string mAwardCode = 1;
    let $mAwardCode = message.mAwardCode;
    if ($mAwardCode !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mAwardCode);
    }
  }
  
  export function decoderequestCollectWebAwardC2S(binary: Uint8Array): requestCollectWebAwardC2S {
    return _decoderequestCollectWebAwardC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestCollectWebAwardC2S(bb: ByteBuffer): requestCollectWebAwardC2S {
    let message: requestCollectWebAwardC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mAwardCode = 1;
        case 1: {
          message.mAwardCode = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAwardCode === undefined)
      throw new Error("Missing required field: mAwardCode");
  
    return message;
  }
  
  export interface requestCollectWebAwardS2C {
    mResult: number;
    mMoney: number;
  }
  
  export function encoderequestCollectWebAwardS2C(message: requestCollectWebAwardS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestCollectWebAwardS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestCollectWebAwardS2C(message: requestCollectWebAwardS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mMoney = 2;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mMoney));
    }
  }
  
  export function decoderequestCollectWebAwardS2C(binary: Uint8Array): requestCollectWebAwardS2C {
    return _decoderequestCollectWebAwardS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestCollectWebAwardS2C(bb: ByteBuffer): requestCollectWebAwardS2C {
    let message: requestCollectWebAwardS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mMoney = 2;
        case 2: {
          message.mMoney = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    return message;
  }
  
  export interface serverKickPlayerToHallS2C {
    mCode: number;
  }
  
  export function encodeserverKickPlayerToHallS2C(message: serverKickPlayerToHallS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeserverKickPlayerToHallS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeserverKickPlayerToHallS2C(message: serverKickPlayerToHallS2C, bb: ByteBuffer): void {
    // required int32 mCode = 1;
    let $mCode = message.mCode;
    if ($mCode !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mCode));
    }
  }
  
  export function decodeserverKickPlayerToHallS2C(binary: Uint8Array): serverKickPlayerToHallS2C {
    return _decodeserverKickPlayerToHallS2C(wrapByteBuffer(binary));
  }
  
  function _decodeserverKickPlayerToHallS2C(bb: ByteBuffer): serverKickPlayerToHallS2C {
    let message: serverKickPlayerToHallS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mCode = 1;
        case 1: {
          message.mCode = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mCode === undefined)
      throw new Error("Missing required field: mCode");
  
    return message;
  }
  
  export interface requestCanPlayGameListC2S {
  }
  
  export function encoderequestCanPlayGameListC2S(message: requestCanPlayGameListC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestCanPlayGameListC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestCanPlayGameListC2S(message: requestCanPlayGameListC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestCanPlayGameListC2S(binary: Uint8Array): requestCanPlayGameListC2S {
    return _decoderequestCanPlayGameListC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestCanPlayGameListC2S(bb: ByteBuffer): requestCanPlayGameListC2S {
    let message: requestCanPlayGameListC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestCanPlayGameListS2C {
    mResult: number;
    mGameList?: number[];
  }
  
  export function encoderequestCanPlayGameListS2C(message: requestCanPlayGameListS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestCanPlayGameListS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestCanPlayGameListS2C(message: requestCanPlayGameListS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // repeated int32 mGameList = 2;
    let array$mGameList = message.mGameList;
    if (array$mGameList !== undefined) {
      let packed = popByteBuffer();
      for (let value of array$mGameList) {
        writeVarint64(packed, intToLong(value));
      }
      writeVarint32(bb, 18);
      writeVarint32(bb, packed.offset);
      writeByteBuffer(bb, packed);
      pushByteBuffer(packed);
    }
  }
  
  export function decoderequestCanPlayGameListS2C(binary: Uint8Array): requestCanPlayGameListS2C {
    return _decoderequestCanPlayGameListS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestCanPlayGameListS2C(bb: ByteBuffer): requestCanPlayGameListS2C {
    let message: requestCanPlayGameListS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // repeated int32 mGameList = 2;
        case 2: {
          let values = message.mGameList || (message.mGameList = []);
          if ((tag & 7) === 2) {
            let outerLimit = pushTemporaryLength(bb);
            while (!isAtEnd(bb)) {
              values.push(readVarint32(bb));
            }
            bb.limit = outerLimit;
          } else {
            values.push(readVarint32(bb));
          }
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface requestPlayTimeAwardC2S {
  }
  
  export function encoderequestPlayTimeAwardC2S(message: requestPlayTimeAwardC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPlayTimeAwardC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPlayTimeAwardC2S(message: requestPlayTimeAwardC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestPlayTimeAwardC2S(binary: Uint8Array): requestPlayTimeAwardC2S {
    return _decoderequestPlayTimeAwardC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestPlayTimeAwardC2S(bb: ByteBuffer): requestPlayTimeAwardC2S {
    let message: requestPlayTimeAwardC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestPlayTimeAwardS2C {
    mResult: number;
    mMoney: number;
  }
  
  export function encoderequestPlayTimeAwardS2C(message: requestPlayTimeAwardS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestPlayTimeAwardS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestPlayTimeAwardS2C(message: requestPlayTimeAwardS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mMoney = 2;
    let $mMoney = message.mMoney;
    if ($mMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mMoney));
    }
  }
  
  export function decoderequestPlayTimeAwardS2C(binary: Uint8Array): requestPlayTimeAwardS2C {
    return _decoderequestPlayTimeAwardS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestPlayTimeAwardS2C(bb: ByteBuffer): requestPlayTimeAwardS2C {
    let message: requestPlayTimeAwardS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mMoney = 2;
        case 2: {
          message.mMoney = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mMoney === undefined)
      throw new Error("Missing required field: mMoney");
  
    return message;
  }
  
  export interface messageInfo {
    mMsgID: Long;
    mAgentID: number;
    mContentType: number;
    mContent: string;
  }
  
  export function encodemessageInfo(message: messageInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodemessageInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodemessageInfo(message: messageInfo, bb: ByteBuffer): void {
    // required int64 mMsgID = 1;
    let $mMsgID = message.mMsgID;
    if ($mMsgID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, $mMsgID);
    }
  
    // required int32 mAgentID = 2;
    let $mAgentID = message.mAgentID;
    if ($mAgentID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mAgentID));
    }
  
    // required int32 mContentType = 3;
    let $mContentType = message.mContentType;
    if ($mContentType !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mContentType));
    }
  
    // required string mContent = 4;
    let $mContent = message.mContent;
    if ($mContent !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mContent);
    }
  }
  
  export function decodemessageInfo(binary: Uint8Array): messageInfo {
    return _decodemessageInfo(wrapByteBuffer(binary));
  }
  
  function _decodemessageInfo(bb: ByteBuffer): messageInfo {
    let message: messageInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int64 mMsgID = 1;
        case 1: {
          message.mMsgID = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        // required int32 mAgentID = 2;
        case 2: {
          message.mAgentID = readVarint32(bb);
          break;
        }
  
        // required int32 mContentType = 3;
        case 3: {
          message.mContentType = readVarint32(bb);
          break;
        }
  
        // required string mContent = 4;
        case 4: {
          message.mContent = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mMsgID === undefined)
      throw new Error("Missing required field: mMsgID");
  
    if (message.mAgentID === undefined)
      throw new Error("Missing required field: mAgentID");
  
    if (message.mContentType === undefined)
      throw new Error("Missing required field: mContentType");
  
    if (message.mContent === undefined)
      throw new Error("Missing required field: mContent");
  
    return message;
  }
  
  export interface sendMessageC2S {
    mData: messageInfo;
  }
  
  export function encodesendMessageC2S(message: sendMessageC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodesendMessageC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodesendMessageC2S(message: sendMessageC2S, bb: ByteBuffer): void {
    // required messageInfo mData = 1;
    let $mData = message.mData;
    if ($mData !== undefined) {
      writeVarint32(bb, 10);
      let nested = popByteBuffer();
      _encodemessageInfo($mData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decodesendMessageC2S(binary: Uint8Array): sendMessageC2S {
    return _decodesendMessageC2S(wrapByteBuffer(binary));
  }
  
  function _decodesendMessageC2S(bb: ByteBuffer): sendMessageC2S {
    let message: sendMessageC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required messageInfo mData = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          message.mData = _decodemessageInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mData === undefined)
      throw new Error("Missing required field: mData");
  
    return message;
  }
  
  export interface sendMessageS2C {
    mMsgID: Long;
  }
  
  export function encodesendMessageS2C(message: sendMessageS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodesendMessageS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodesendMessageS2C(message: sendMessageS2C, bb: ByteBuffer): void {
    // required int64 mMsgID = 1;
    let $mMsgID = message.mMsgID;
    if ($mMsgID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, $mMsgID);
    }
  }
  
  export function decodesendMessageS2C(binary: Uint8Array): sendMessageS2C {
    return _decodesendMessageS2C(wrapByteBuffer(binary));
  }
  
  function _decodesendMessageS2C(bb: ByteBuffer): sendMessageS2C {
    let message: sendMessageS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int64 mMsgID = 1;
        case 1: {
          message.mMsgID = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mMsgID === undefined)
      throw new Error("Missing required field: mMsgID");
  
    return message;
  }
  
  export interface pushAgentMessageS2C {
    mData: messageInfo;
  }
  
  export function encodepushAgentMessageS2C(message: pushAgentMessageS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushAgentMessageS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushAgentMessageS2C(message: pushAgentMessageS2C, bb: ByteBuffer): void {
    // required messageInfo mData = 1;
    let $mData = message.mData;
    if ($mData !== undefined) {
      writeVarint32(bb, 10);
      let nested = popByteBuffer();
      _encodemessageInfo($mData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decodepushAgentMessageS2C(binary: Uint8Array): pushAgentMessageS2C {
    return _decodepushAgentMessageS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushAgentMessageS2C(bb: ByteBuffer): pushAgentMessageS2C {
    let message: pushAgentMessageS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required messageInfo mData = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          message.mData = _decodemessageInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mData === undefined)
      throw new Error("Missing required field: mData");
  
    return message;
  }
  
  export interface pushAgentMessageC2S {
    mMsgID: Long;
  }
  
  export function encodepushAgentMessageC2S(message: pushAgentMessageC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodepushAgentMessageC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushAgentMessageC2S(message: pushAgentMessageC2S, bb: ByteBuffer): void {
    // required int64 mMsgID = 1;
    let $mMsgID = message.mMsgID;
    if ($mMsgID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, $mMsgID);
    }
  }
  
  export function decodepushAgentMessageC2S(binary: Uint8Array): pushAgentMessageC2S {
    return _decodepushAgentMessageC2S(wrapByteBuffer(binary));
  }
  
  function _decodepushAgentMessageC2S(bb: ByteBuffer): pushAgentMessageC2S {
    let message: pushAgentMessageC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int64 mMsgID = 1;
        case 1: {
          message.mMsgID = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mMsgID === undefined)
      throw new Error("Missing required field: mMsgID");
  
    return message;
  }
  
  export interface requestOffLineMessageC2S {
  }
  
  export function encoderequestOffLineMessageC2S(message: requestOffLineMessageC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestOffLineMessageC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestOffLineMessageC2S(message: requestOffLineMessageC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestOffLineMessageC2S(binary: Uint8Array): requestOffLineMessageC2S {
    return _decoderequestOffLineMessageC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestOffLineMessageC2S(bb: ByteBuffer): requestOffLineMessageC2S {
    let message: requestOffLineMessageC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestOffLineMessageS2C {
    mDatas?: messageInfo[];
  }
  
  export function encoderequestOffLineMessageS2C(message: requestOffLineMessageS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestOffLineMessageS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestOffLineMessageS2C(message: requestOffLineMessageS2C, bb: ByteBuffer): void {
    // repeated messageInfo mDatas = 1;
    let array$mDatas = message.mDatas;
    if (array$mDatas !== undefined) {
      for (let value of array$mDatas) {
        writeVarint32(bb, 10);
        let nested = popByteBuffer();
        _encodemessageInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decoderequestOffLineMessageS2C(binary: Uint8Array): requestOffLineMessageS2C {
    return _decoderequestOffLineMessageS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestOffLineMessageS2C(bb: ByteBuffer): requestOffLineMessageS2C {
    let message: requestOffLineMessageS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated messageInfo mDatas = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          let values = message.mDatas || (message.mDatas = []);
          values.push(_decodemessageInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface confirmOffLineMessageC2S {
  }
  
  export function encodeconfirmOffLineMessageC2S(message: confirmOffLineMessageC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodeconfirmOffLineMessageC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeconfirmOffLineMessageC2S(message: confirmOffLineMessageC2S, bb: ByteBuffer): void {
  }
  
  export function decodeconfirmOffLineMessageC2S(binary: Uint8Array): confirmOffLineMessageC2S {
    return _decodeconfirmOffLineMessageC2S(wrapByteBuffer(binary));
  }
  
  function _decodeconfirmOffLineMessageC2S(bb: ByteBuffer): confirmOffLineMessageC2S {
    let message: confirmOffLineMessageC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestRechargeSlotC2S {
    mOdds: number;
  }
  
  export function encoderequestRechargeSlotC2S(message: requestRechargeSlotC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRechargeSlotC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRechargeSlotC2S(message: requestRechargeSlotC2S, bb: ByteBuffer): void {
    // required int32 mOdds = 1;
    let $mOdds = message.mOdds;
    if ($mOdds !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mOdds));
    }
  }
  
  export function decoderequestRechargeSlotC2S(binary: Uint8Array): requestRechargeSlotC2S {
    return _decoderequestRechargeSlotC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestRechargeSlotC2S(bb: ByteBuffer): requestRechargeSlotC2S {
    let message: requestRechargeSlotC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mOdds = 1;
        case 1: {
          message.mOdds = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mOdds === undefined)
      throw new Error("Missing required field: mOdds");
  
    return message;
  }
  
  export interface requestRechargeSlotS2C {
    mResult: number;
    mAwardIndex: number;
    mOdds: number;
    mSlotTimes: number;
  }
  
  export function encoderequestRechargeSlotS2C(message: requestRechargeSlotS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRechargeSlotS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRechargeSlotS2C(message: requestRechargeSlotS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int32 mAwardIndex = 2;
    let $mAwardIndex = message.mAwardIndex;
    if ($mAwardIndex !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mAwardIndex));
    }
  
    // required int32 mOdds = 3;
    let $mOdds = message.mOdds;
    if ($mOdds !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mOdds));
    }
  
    // required int32 mSlotTimes = 4;
    let $mSlotTimes = message.mSlotTimes;
    if ($mSlotTimes !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mSlotTimes));
    }
  }
  
  export function decoderequestRechargeSlotS2C(binary: Uint8Array): requestRechargeSlotS2C {
    return _decoderequestRechargeSlotS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestRechargeSlotS2C(bb: ByteBuffer): requestRechargeSlotS2C {
    let message: requestRechargeSlotS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int32 mAwardIndex = 2;
        case 2: {
          message.mAwardIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mOdds = 3;
        case 3: {
          message.mOdds = readVarint32(bb);
          break;
        }
  
        // required int32 mSlotTimes = 4;
        case 4: {
          message.mSlotTimes = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mAwardIndex === undefined)
      throw new Error("Missing required field: mAwardIndex");
  
    if (message.mOdds === undefined)
      throw new Error("Missing required field: mOdds");
  
    if (message.mSlotTimes === undefined)
      throw new Error("Missing required field: mSlotTimes");
  
    return message;
  }
  
  export interface pushActivityRechargeS2C {
    mAllRecharge: number;
    mSlotTimes: number;
  }
  
  export function encodepushActivityRechargeS2C(message: pushActivityRechargeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushActivityRechargeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushActivityRechargeS2C(message: pushActivityRechargeS2C, bb: ByteBuffer): void {
    // required int32 mAllRecharge = 1;
    let $mAllRecharge = message.mAllRecharge;
    if ($mAllRecharge !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mAllRecharge));
    }
  
    // required int32 mSlotTimes = 2;
    let $mSlotTimes = message.mSlotTimes;
    if ($mSlotTimes !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mSlotTimes));
    }
  }
  
  export function decodepushActivityRechargeS2C(binary: Uint8Array): pushActivityRechargeS2C {
    return _decodepushActivityRechargeS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushActivityRechargeS2C(bb: ByteBuffer): pushActivityRechargeS2C {
    let message: pushActivityRechargeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mAllRecharge = 1;
        case 1: {
          message.mAllRecharge = readVarint32(bb);
          break;
        }
  
        // required int32 mSlotTimes = 2;
        case 2: {
          message.mSlotTimes = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAllRecharge === undefined)
      throw new Error("Missing required field: mAllRecharge");
  
    if (message.mSlotTimes === undefined)
      throw new Error("Missing required field: mSlotTimes");
  
    return message;
  }
  
  export interface exchangeInfo {
    mType: number;
    mParms?: string[];
  }
  
  export function encodeexchangeInfo(message: exchangeInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeexchangeInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeexchangeInfo(message: exchangeInfo, bb: ByteBuffer): void {
    // required int32 mType = 1;
    let $mType = message.mType;
    if ($mType !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mType));
    }
  
    // repeated string mParms = 2;
    let array$mParms = message.mParms;
    if (array$mParms !== undefined) {
      for (let value of array$mParms) {
        writeVarint32(bb, 18);
        writeString(bb, value);
      }
    }
  }
  
  export function decodeexchangeInfo(binary: Uint8Array): exchangeInfo {
    return _decodeexchangeInfo(wrapByteBuffer(binary));
  }
  
  function _decodeexchangeInfo(bb: ByteBuffer): exchangeInfo {
    let message: exchangeInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mType = 1;
        case 1: {
          message.mType = readVarint32(bb);
          break;
        }
  
        // repeated string mParms = 2;
        case 2: {
          let values = message.mParms || (message.mParms = []);
          values.push(readString(bb, readVarint32(bb)));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mType === undefined)
      throw new Error("Missing required field: mType");
  
    return message;
  }
  
  export interface requestAllExchangeInfoC2S {
  }
  
  export function encoderequestAllExchangeInfoC2S(message: requestAllExchangeInfoC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestAllExchangeInfoC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestAllExchangeInfoC2S(message: requestAllExchangeInfoC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestAllExchangeInfoC2S(binary: Uint8Array): requestAllExchangeInfoC2S {
    return _decoderequestAllExchangeInfoC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestAllExchangeInfoC2S(bb: ByteBuffer): requestAllExchangeInfoC2S {
    let message: requestAllExchangeInfoC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestAllExchangeInfoS2C {
    mExchangeTypes?: number[];
    mBindExchangeInfos?: exchangeInfo[];
    mQQ: string;
    mWechat: string;
  }
  
  export function encoderequestAllExchangeInfoS2C(message: requestAllExchangeInfoS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestAllExchangeInfoS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestAllExchangeInfoS2C(message: requestAllExchangeInfoS2C, bb: ByteBuffer): void {
    // repeated int32 mExchangeTypes = 1;
    let array$mExchangeTypes = message.mExchangeTypes;
    if (array$mExchangeTypes !== undefined) {
      let packed = popByteBuffer();
      for (let value of array$mExchangeTypes) {
        writeVarint64(packed, intToLong(value));
      }
      writeVarint32(bb, 10);
      writeVarint32(bb, packed.offset);
      writeByteBuffer(bb, packed);
      pushByteBuffer(packed);
    }
  
    // repeated exchangeInfo mBindExchangeInfos = 2;
    let array$mBindExchangeInfos = message.mBindExchangeInfos;
    if (array$mBindExchangeInfos !== undefined) {
      for (let value of array$mBindExchangeInfos) {
        writeVarint32(bb, 18);
        let nested = popByteBuffer();
        _encodeexchangeInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  
    // required string mQQ = 3;
    let $mQQ = message.mQQ;
    if ($mQQ !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mQQ);
    }
  
    // required string mWechat = 4;
    let $mWechat = message.mWechat;
    if ($mWechat !== undefined) {
      writeVarint32(bb, 34);
      writeString(bb, $mWechat);
    }
  }
  
  export function decoderequestAllExchangeInfoS2C(binary: Uint8Array): requestAllExchangeInfoS2C {
    return _decoderequestAllExchangeInfoS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestAllExchangeInfoS2C(bb: ByteBuffer): requestAllExchangeInfoS2C {
    let message: requestAllExchangeInfoS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated int32 mExchangeTypes = 1;
        case 1: {
          let values = message.mExchangeTypes || (message.mExchangeTypes = []);
          if ((tag & 7) === 2) {
            let outerLimit = pushTemporaryLength(bb);
            while (!isAtEnd(bb)) {
              values.push(readVarint32(bb));
            }
            bb.limit = outerLimit;
          } else {
            values.push(readVarint32(bb));
          }
          break;
        }
  
        // repeated exchangeInfo mBindExchangeInfos = 2;
        case 2: {
          let limit = pushTemporaryLength(bb);
          let values = message.mBindExchangeInfos || (message.mBindExchangeInfos = []);
          values.push(_decodeexchangeInfo(bb));
          bb.limit = limit;
          break;
        }
  
        // required string mQQ = 3;
        case 3: {
          message.mQQ = readString(bb, readVarint32(bb));
          break;
        }
  
        // required string mWechat = 4;
        case 4: {
          message.mWechat = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mQQ === undefined)
      throw new Error("Missing required field: mQQ");
  
    if (message.mWechat === undefined)
      throw new Error("Missing required field: mWechat");
  
    return message;
  }
  
  export interface requestBindExchangeInfoC2S {
    mExchangeData: exchangeInfo;
  }
  
  export function encoderequestBindExchangeInfoC2S(message: requestBindExchangeInfoC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestBindExchangeInfoC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestBindExchangeInfoC2S(message: requestBindExchangeInfoC2S, bb: ByteBuffer): void {
    // required exchangeInfo mExchangeData = 1;
    let $mExchangeData = message.mExchangeData;
    if ($mExchangeData !== undefined) {
      writeVarint32(bb, 10);
      let nested = popByteBuffer();
      _encodeexchangeInfo($mExchangeData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decoderequestBindExchangeInfoC2S(binary: Uint8Array): requestBindExchangeInfoC2S {
    return _decoderequestBindExchangeInfoC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestBindExchangeInfoC2S(bb: ByteBuffer): requestBindExchangeInfoC2S {
    let message: requestBindExchangeInfoC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required exchangeInfo mExchangeData = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          message.mExchangeData = _decodeexchangeInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mExchangeData === undefined)
      throw new Error("Missing required field: mExchangeData");
  
    return message;
  }
  
  export interface requestBindExchangeInfoS2C {
    mResult: number;
    mExchangeData?: exchangeInfo;
  }
  
  export function encoderequestBindExchangeInfoS2C(message: requestBindExchangeInfoS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestBindExchangeInfoS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestBindExchangeInfoS2C(message: requestBindExchangeInfoS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // optional exchangeInfo mExchangeData = 2;
    let $mExchangeData = message.mExchangeData;
    if ($mExchangeData !== undefined) {
      writeVarint32(bb, 18);
      let nested = popByteBuffer();
      _encodeexchangeInfo($mExchangeData, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
  
  export function decoderequestBindExchangeInfoS2C(binary: Uint8Array): requestBindExchangeInfoS2C {
    return _decoderequestBindExchangeInfoS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestBindExchangeInfoS2C(bb: ByteBuffer): requestBindExchangeInfoS2C {
    let message: requestBindExchangeInfoS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // optional exchangeInfo mExchangeData = 2;
        case 2: {
          let limit = pushTemporaryLength(bb);
          message.mExchangeData = _decodeexchangeInfo(bb);
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface requestExchangeC2S {
    mExchangeType: number;
    mExchangeMoney: number;
  }
  
  export function encoderequestExchangeC2S(message: requestExchangeC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestExchangeC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestExchangeC2S(message: requestExchangeC2S, bb: ByteBuffer): void {
    // required int32 mExchangeType = 1;
    let $mExchangeType = message.mExchangeType;
    if ($mExchangeType !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mExchangeType));
    }
  
    // required int32 mExchangeMoney = 2;
    let $mExchangeMoney = message.mExchangeMoney;
    if ($mExchangeMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mExchangeMoney));
    }
  }
  
  export function decoderequestExchangeC2S(binary: Uint8Array): requestExchangeC2S {
    return _decoderequestExchangeC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestExchangeC2S(bb: ByteBuffer): requestExchangeC2S {
    let message: requestExchangeC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mExchangeType = 1;
        case 1: {
          message.mExchangeType = readVarint32(bb);
          break;
        }
  
        // required int32 mExchangeMoney = 2;
        case 2: {
          message.mExchangeMoney = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mExchangeType === undefined)
      throw new Error("Missing required field: mExchangeType");
  
    if (message.mExchangeMoney === undefined)
      throw new Error("Missing required field: mExchangeMoney");
  
    return message;
  }
  
  export interface requestExchangeS2C {
    mResult: number;
  }
  
  export function encoderequestExchangeS2C(message: requestExchangeS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestExchangeS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestExchangeS2C(message: requestExchangeS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decoderequestExchangeS2C(binary: Uint8Array): requestExchangeS2C {
    return _decoderequestExchangeS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestExchangeS2C(bb: ByteBuffer): requestExchangeS2C {
    let message: requestExchangeS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface requestExchangeRecordInfoC2S {
  }
  
  export function encoderequestExchangeRecordInfoC2S(message: requestExchangeRecordInfoC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestExchangeRecordInfoC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestExchangeRecordInfoC2S(message: requestExchangeRecordInfoC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestExchangeRecordInfoC2S(binary: Uint8Array): requestExchangeRecordInfoC2S {
    return _decoderequestExchangeRecordInfoC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestExchangeRecordInfoC2S(bb: ByteBuffer): requestExchangeRecordInfoC2S {
    let message: requestExchangeRecordInfoC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestExchangeRecordInfoS2C {
    mAllRecordCount: number;
    mDayExchangeMoney: number;
    mMonthExchangeMoney: number;
    mAllExchangeMoney: number;
  }
  
  export function encoderequestExchangeRecordInfoS2C(message: requestExchangeRecordInfoS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestExchangeRecordInfoS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestExchangeRecordInfoS2C(message: requestExchangeRecordInfoS2C, bb: ByteBuffer): void {
    // required int32 mAllRecordCount = 1;
    let $mAllRecordCount = message.mAllRecordCount;
    if ($mAllRecordCount !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mAllRecordCount));
    }
  
    // required int32 mDayExchangeMoney = 2;
    let $mDayExchangeMoney = message.mDayExchangeMoney;
    if ($mDayExchangeMoney !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mDayExchangeMoney));
    }
  
    // required int32 mMonthExchangeMoney = 3;
    let $mMonthExchangeMoney = message.mMonthExchangeMoney;
    if ($mMonthExchangeMoney !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mMonthExchangeMoney));
    }
  
    // required int32 mAllExchangeMoney = 4;
    let $mAllExchangeMoney = message.mAllExchangeMoney;
    if ($mAllExchangeMoney !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mAllExchangeMoney));
    }
  }
  
  export function decoderequestExchangeRecordInfoS2C(binary: Uint8Array): requestExchangeRecordInfoS2C {
    return _decoderequestExchangeRecordInfoS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestExchangeRecordInfoS2C(bb: ByteBuffer): requestExchangeRecordInfoS2C {
    let message: requestExchangeRecordInfoS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mAllRecordCount = 1;
        case 1: {
          message.mAllRecordCount = readVarint32(bb);
          break;
        }
  
        // required int32 mDayExchangeMoney = 2;
        case 2: {
          message.mDayExchangeMoney = readVarint32(bb);
          break;
        }
  
        // required int32 mMonthExchangeMoney = 3;
        case 3: {
          message.mMonthExchangeMoney = readVarint32(bb);
          break;
        }
  
        // required int32 mAllExchangeMoney = 4;
        case 4: {
          message.mAllExchangeMoney = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mAllRecordCount === undefined)
      throw new Error("Missing required field: mAllRecordCount");
  
    if (message.mDayExchangeMoney === undefined)
      throw new Error("Missing required field: mDayExchangeMoney");
  
    if (message.mMonthExchangeMoney === undefined)
      throw new Error("Missing required field: mMonthExchangeMoney");
  
    if (message.mAllExchangeMoney === undefined)
      throw new Error("Missing required field: mAllExchangeMoney");
  
    return message;
  }
  
  export interface requestExchangeRecordC2S {
    mStartIndex: number;
    mRequestCount: number;
  }
  
  export function encoderequestExchangeRecordC2S(message: requestExchangeRecordC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestExchangeRecordC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestExchangeRecordC2S(message: requestExchangeRecordC2S, bb: ByteBuffer): void {
    // required int32 mStartIndex = 1;
    let $mStartIndex = message.mStartIndex;
    if ($mStartIndex !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mStartIndex));
    }
  
    // required int32 mRequestCount = 2;
    let $mRequestCount = message.mRequestCount;
    if ($mRequestCount !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRequestCount));
    }
  }
  
  export function decoderequestExchangeRecordC2S(binary: Uint8Array): requestExchangeRecordC2S {
    return _decoderequestExchangeRecordC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestExchangeRecordC2S(bb: ByteBuffer): requestExchangeRecordC2S {
    let message: requestExchangeRecordC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mStartIndex = 1;
        case 1: {
          message.mStartIndex = readVarint32(bb);
          break;
        }
  
        // required int32 mRequestCount = 2;
        case 2: {
          message.mRequestCount = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mStartIndex === undefined)
      throw new Error("Missing required field: mStartIndex");
  
    if (message.mRequestCount === undefined)
      throw new Error("Missing required field: mRequestCount");
  
    return message;
  }
  
  export interface exchangeRecordInfo {
    mTimeStamp: number;
    mExchangeType: number;
    mExchargeOrder: string;
    mExchangeMoney: number;
    mOrderState: number;
  }
  
  export function encodeexchangeRecordInfo(message: exchangeRecordInfo): Uint8Array {
    let bb = popByteBuffer();
    _encodeexchangeRecordInfo(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeexchangeRecordInfo(message: exchangeRecordInfo, bb: ByteBuffer): void {
    // required int32 mTimeStamp = 1;
    let $mTimeStamp = message.mTimeStamp;
    if ($mTimeStamp !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mTimeStamp));
    }
  
    // required int32 mExchangeType = 2;
    let $mExchangeType = message.mExchangeType;
    if ($mExchangeType !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mExchangeType));
    }
  
    // required string mExchargeOrder = 3;
    let $mExchargeOrder = message.mExchargeOrder;
    if ($mExchargeOrder !== undefined) {
      writeVarint32(bb, 26);
      writeString(bb, $mExchargeOrder);
    }
  
    // required int32 mExchangeMoney = 4;
    let $mExchangeMoney = message.mExchangeMoney;
    if ($mExchangeMoney !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mExchangeMoney));
    }
  
    // required int32 mOrderState = 5;
    let $mOrderState = message.mOrderState;
    if ($mOrderState !== undefined) {
      writeVarint32(bb, 40);
      writeVarint64(bb, intToLong($mOrderState));
    }
  }
  
  export function decodeexchangeRecordInfo(binary: Uint8Array): exchangeRecordInfo {
    return _decodeexchangeRecordInfo(wrapByteBuffer(binary));
  }
  
  function _decodeexchangeRecordInfo(bb: ByteBuffer): exchangeRecordInfo {
    let message: exchangeRecordInfo = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mTimeStamp = 1;
        case 1: {
          message.mTimeStamp = readVarint32(bb);
          break;
        }
  
        // required int32 mExchangeType = 2;
        case 2: {
          message.mExchangeType = readVarint32(bb);
          break;
        }
  
        // required string mExchargeOrder = 3;
        case 3: {
          message.mExchargeOrder = readString(bb, readVarint32(bb));
          break;
        }
  
        // required int32 mExchangeMoney = 4;
        case 4: {
          message.mExchangeMoney = readVarint32(bb);
          break;
        }
  
        // required int32 mOrderState = 5;
        case 5: {
          message.mOrderState = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mTimeStamp === undefined)
      throw new Error("Missing required field: mTimeStamp");
  
    if (message.mExchangeType === undefined)
      throw new Error("Missing required field: mExchangeType");
  
    if (message.mExchargeOrder === undefined)
      throw new Error("Missing required field: mExchargeOrder");
  
    if (message.mExchangeMoney === undefined)
      throw new Error("Missing required field: mExchangeMoney");
  
    if (message.mOrderState === undefined)
      throw new Error("Missing required field: mOrderState");
  
    return message;
  }
  
  export interface requestExchangeRecordS2C {
    mRecords?: exchangeRecordInfo[];
  }
  
  export function encoderequestExchangeRecordS2C(message: requestExchangeRecordS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestExchangeRecordS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestExchangeRecordS2C(message: requestExchangeRecordS2C, bb: ByteBuffer): void {
    // repeated exchangeRecordInfo mRecords = 1;
    let array$mRecords = message.mRecords;
    if (array$mRecords !== undefined) {
      for (let value of array$mRecords) {
        writeVarint32(bb, 10);
        let nested = popByteBuffer();
        _encodeexchangeRecordInfo(value, nested);
        writeVarint32(bb, nested.limit);
        writeByteBuffer(bb, nested);
        pushByteBuffer(nested);
      }
    }
  }
  
  export function decoderequestExchangeRecordS2C(binary: Uint8Array): requestExchangeRecordS2C {
    return _decoderequestExchangeRecordS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestExchangeRecordS2C(bb: ByteBuffer): requestExchangeRecordS2C {
    let message: requestExchangeRecordS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated exchangeRecordInfo mRecords = 1;
        case 1: {
          let limit = pushTemporaryLength(bb);
          let values = message.mRecords || (message.mRecords = []);
          values.push(_decodeexchangeRecordInfo(bb));
          bb.limit = limit;
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestRedPacketC2S {
  }
  
  export function encoderequestRedPacketC2S(message: requestRedPacketC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRedPacketC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRedPacketC2S(message: requestRedPacketC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestRedPacketC2S(binary: Uint8Array): requestRedPacketC2S {
    return _decoderequestRedPacketC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestRedPacketC2S(bb: ByteBuffer): requestRedPacketC2S {
    let message: requestRedPacketC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestRedPacketS2C {
    mGold: Long;
  }
  
  export function encoderequestRedPacketS2C(message: requestRedPacketS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestRedPacketS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestRedPacketS2C(message: requestRedPacketS2C, bb: ByteBuffer): void {
    // required int64 mGold = 1;
    let $mGold = message.mGold;
    if ($mGold !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, $mGold);
    }
  }
  
  export function decoderequestRedPacketS2C(binary: Uint8Array): requestRedPacketS2C {
    return _decoderequestRedPacketS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestRedPacketS2C(bb: ByteBuffer): requestRedPacketS2C {
    let message: requestRedPacketS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int64 mGold = 1;
        case 1: {
          message.mGold = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mGold === undefined)
      throw new Error("Missing required field: mGold");
  
    return message;
  }
  
  export interface requestOpenRedPacketC2S {
  }
  
  export function encoderequestOpenRedPacketC2S(message: requestOpenRedPacketC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestOpenRedPacketC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestOpenRedPacketC2S(message: requestOpenRedPacketC2S, bb: ByteBuffer): void {
  }
  
  export function decoderequestOpenRedPacketC2S(binary: Uint8Array): requestOpenRedPacketC2S {
    return _decoderequestOpenRedPacketC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestOpenRedPacketC2S(bb: ByteBuffer): requestOpenRedPacketC2S {
    let message: requestOpenRedPacketC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface requestOpenRedPacketS2C {
    mResult: number;
    mGold: Long;
  }
  
  export function encoderequestOpenRedPacketS2C(message: requestOpenRedPacketS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestOpenRedPacketS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestOpenRedPacketS2C(message: requestOpenRedPacketS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  
    // required int64 mGold = 2;
    let $mGold = message.mGold;
    if ($mGold !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, $mGold);
    }
  }
  
  export function decoderequestOpenRedPacketS2C(binary: Uint8Array): requestOpenRedPacketS2C {
    return _decoderequestOpenRedPacketS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestOpenRedPacketS2C(bb: ByteBuffer): requestOpenRedPacketS2C {
    let message: requestOpenRedPacketS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        // required int64 mGold = 2;
        case 2: {
          message.mGold = readVarint64(bb, /* unsigned */ false);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    if (message.mGold === undefined)
      throw new Error("Missing required field: mGold");
  
    return message;
  }
  
  export interface requestWorldChannelC2S {
    mContent: string;
  }
  
  export function encoderequestWorldChannelC2S(message: requestWorldChannelC2S): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestWorldChannelC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestWorldChannelC2S(message: requestWorldChannelC2S, bb: ByteBuffer): void {
    // required string mContent = 1;
    let $mContent = message.mContent;
    if ($mContent !== undefined) {
      writeVarint32(bb, 10);
      writeString(bb, $mContent);
    }
  }
  
  export function decoderequestWorldChannelC2S(binary: Uint8Array): requestWorldChannelC2S {
    return _decoderequestWorldChannelC2S(wrapByteBuffer(binary));
  }
  
  function _decoderequestWorldChannelC2S(bb: ByteBuffer): requestWorldChannelC2S {
    let message: requestWorldChannelC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required string mContent = 1;
        case 1: {
          message.mContent = readString(bb, readVarint32(bb));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mContent === undefined)
      throw new Error("Missing required field: mContent");
  
    return message;
  }
  
  export interface requestWorldChannelS2C {
    mResult: number;
  }
  
  export function encoderequestWorldChannelS2C(message: requestWorldChannelS2C): Uint8Array {
    let bb = popByteBuffer();
    _encoderequestWorldChannelS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encoderequestWorldChannelS2C(message: requestWorldChannelS2C, bb: ByteBuffer): void {
    // required int32 mResult = 1;
    let $mResult = message.mResult;
    if ($mResult !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mResult));
    }
  }
  
  export function decoderequestWorldChannelS2C(binary: Uint8Array): requestWorldChannelS2C {
    return _decoderequestWorldChannelS2C(wrapByteBuffer(binary));
  }
  
  function _decoderequestWorldChannelS2C(bb: ByteBuffer): requestWorldChannelS2C {
    let message: requestWorldChannelS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mResult = 1;
        case 1: {
          message.mResult = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mResult === undefined)
      throw new Error("Missing required field: mResult");
  
    return message;
  }
  
  export interface pushWorldChannelS2C {
    mContents?: string[];
  }
  
  export function encodepushWorldChannelS2C(message: pushWorldChannelS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodepushWorldChannelS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodepushWorldChannelS2C(message: pushWorldChannelS2C, bb: ByteBuffer): void {
    // repeated string mContents = 1;
    let array$mContents = message.mContents;
    if (array$mContents !== undefined) {
      for (let value of array$mContents) {
        writeVarint32(bb, 10);
        writeString(bb, value);
      }
    }
  }
  
  export function decodepushWorldChannelS2C(binary: Uint8Array): pushWorldChannelS2C {
    return _decodepushWorldChannelS2C(wrapByteBuffer(binary));
  }
  
  function _decodepushWorldChannelS2C(bb: ByteBuffer): pushWorldChannelS2C {
    let message: pushWorldChannelS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // repeated string mContents = 1;
        case 1: {
          let values = message.mContents || (message.mContents = []);
          values.push(readString(bb, readVarint32(bb)));
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    return message;
  }
  
  export interface sendMagC2S {
    mSendSiteID: number;
    mRecvSiteID: number;
    mMsgType: number;
    mMsgIndex: number;
  }
  
  export function encodesendMagC2S(message: sendMagC2S): Uint8Array {
    let bb = popByteBuffer();
    _encodesendMagC2S(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodesendMagC2S(message: sendMagC2S, bb: ByteBuffer): void {
    // required int32 mSendSiteID = 1;
    let $mSendSiteID = message.mSendSiteID;
    if ($mSendSiteID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mSendSiteID));
    }
  
    // required int32 mRecvSiteID = 2;
    let $mRecvSiteID = message.mRecvSiteID;
    if ($mRecvSiteID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRecvSiteID));
    }
  
    // required int32 mMsgType = 3;
    let $mMsgType = message.mMsgType;
    if ($mMsgType !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mMsgType));
    }
  
    // required int32 mMsgIndex = 4;
    let $mMsgIndex = message.mMsgIndex;
    if ($mMsgIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mMsgIndex));
    }
  }
  
  export function decodesendMagC2S(binary: Uint8Array): sendMagC2S {
    return _decodesendMagC2S(wrapByteBuffer(binary));
  }
  
  function _decodesendMagC2S(bb: ByteBuffer): sendMagC2S {
    let message: sendMagC2S = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mSendSiteID = 1;
        case 1: {
          message.mSendSiteID = readVarint32(bb);
          break;
        }
  
        // required int32 mRecvSiteID = 2;
        case 2: {
          message.mRecvSiteID = readVarint32(bb);
          break;
        }
  
        // required int32 mMsgType = 3;
        case 3: {
          message.mMsgType = readVarint32(bb);
          break;
        }
  
        // required int32 mMsgIndex = 4;
        case 4: {
          message.mMsgIndex = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mSendSiteID === undefined)
      throw new Error("Missing required field: mSendSiteID");
  
    if (message.mRecvSiteID === undefined)
      throw new Error("Missing required field: mRecvSiteID");
  
    if (message.mMsgType === undefined)
      throw new Error("Missing required field: mMsgType");
  
    if (message.mMsgIndex === undefined)
      throw new Error("Missing required field: mMsgIndex");
  
    return message;
  }
  
  export interface sendMagS2C {
    mSendSiteID: number;
    mRecvSiteID: number;
    mMsgType: number;
    mMsgIndex: number;
  }
  
  export function encodesendMagS2C(message: sendMagS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodesendMagS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodesendMagS2C(message: sendMagS2C, bb: ByteBuffer): void {
    // required int32 mSendSiteID = 1;
    let $mSendSiteID = message.mSendSiteID;
    if ($mSendSiteID !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($mSendSiteID));
    }
  
    // required int32 mRecvSiteID = 2;
    let $mRecvSiteID = message.mRecvSiteID;
    if ($mRecvSiteID !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($mRecvSiteID));
    }
  
    // required int32 mMsgType = 3;
    let $mMsgType = message.mMsgType;
    if ($mMsgType !== undefined) {
      writeVarint32(bb, 24);
      writeVarint64(bb, intToLong($mMsgType));
    }
  
    // required int32 mMsgIndex = 4;
    let $mMsgIndex = message.mMsgIndex;
    if ($mMsgIndex !== undefined) {
      writeVarint32(bb, 32);
      writeVarint64(bb, intToLong($mMsgIndex));
    }
  }
  
  export function decodesendMagS2C(binary: Uint8Array): sendMagS2C {
    return _decodesendMagS2C(wrapByteBuffer(binary));
  }
  
  function _decodesendMagS2C(bb: ByteBuffer): sendMagS2C {
    let message: sendMagS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 mSendSiteID = 1;
        case 1: {
          message.mSendSiteID = readVarint32(bb);
          break;
        }
  
        // required int32 mRecvSiteID = 2;
        case 2: {
          message.mRecvSiteID = readVarint32(bb);
          break;
        }
  
        // required int32 mMsgType = 3;
        case 3: {
          message.mMsgType = readVarint32(bb);
          break;
        }
  
        // required int32 mMsgIndex = 4;
        case 4: {
          message.mMsgIndex = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.mSendSiteID === undefined)
      throw new Error("Missing required field: mSendSiteID");
  
    if (message.mRecvSiteID === undefined)
      throw new Error("Missing required field: mRecvSiteID");
  
    if (message.mMsgType === undefined)
      throw new Error("Missing required field: mMsgType");
  
    if (message.mMsgIndex === undefined)
      throw new Error("Missing required field: mMsgIndex");
  
    return message;
  }
  
  export interface serverPushS2C {
    isMail: number;
    isNotice: number;
  }
  
  export function encodeserverPushS2C(message: serverPushS2C): Uint8Array {
    let bb = popByteBuffer();
    _encodeserverPushS2C(message, bb);
    return toUint8Array(bb);
  }
  
  function _encodeserverPushS2C(message: serverPushS2C, bb: ByteBuffer): void {
    // required int32 isMail = 1;
    let $isMail = message.isMail;
    if ($isMail !== undefined) {
      writeVarint32(bb, 8);
      writeVarint64(bb, intToLong($isMail));
    }
  
    // required int32 isNotice = 2;
    let $isNotice = message.isNotice;
    if ($isNotice !== undefined) {
      writeVarint32(bb, 16);
      writeVarint64(bb, intToLong($isNotice));
    }
  }
  
  export function decodeserverPushS2C(binary: Uint8Array): serverPushS2C {
    return _decodeserverPushS2C(wrapByteBuffer(binary));
  }
  
  function _decodeserverPushS2C(bb: ByteBuffer): serverPushS2C {
    let message: serverPushS2C = {} as any;
  
    end_of_message: while (!isAtEnd(bb)) {
      let tag = readVarint32(bb);
  
      switch (tag >>> 3) {
        case 0:
          break end_of_message;
  
        // required int32 isMail = 1;
        case 1: {
          message.isMail = readVarint32(bb);
          break;
        }
  
        // required int32 isNotice = 2;
        case 2: {
          message.isNotice = readVarint32(bb);
          break;
        }
  
        default:
          skipUnknownField(bb, tag & 7);
      }
    }
  
    if (message.isMail === undefined)
      throw new Error("Missing required field: isMail");
  
    if (message.isNotice === undefined)
      throw new Error("Missing required field: isNotice");
  
    return message;
  }
  
  export interface Long {
    low: number;
    high: number;
    unsigned: boolean;
  }
  
  interface ByteBuffer {
    bytes: Uint8Array;
    offset: number;
    limit: number;
  }
  
  function pushTemporaryLength(bb: ByteBuffer): number {
    let length = readVarint32(bb);
    let limit = bb.limit;
    bb.limit = bb.offset + length;
    return limit;
  }
  
  function skipUnknownField(bb: ByteBuffer, type: number): void {
    switch (type) {
      case 0: while (readByte(bb) & 0x80) { } break;
      case 2: skip(bb, readVarint32(bb)); break;
      case 5: skip(bb, 4); break;
      case 1: skip(bb, 8); break;
      default: throw new Error("Unimplemented type: " + type);
    }
  }
  
  function stringToLong(value: string): Long {
    return {
      low: value.charCodeAt(0) | (value.charCodeAt(1) << 16),
      high: value.charCodeAt(2) | (value.charCodeAt(3) << 16),
      unsigned: false,
    };
  }
  
  function longToString(value: Long): string {
    let low = value.low;
    let high = value.high;
    return String.fromCharCode(
      low & 0xFFFF,
      low >>> 16,
      high & 0xFFFF,
      high >>> 16);
  }
  
  // The code below was modified from https://github.com/protobufjs/bytebuffer.js
  // which is under the Apache License 2.0.
  
  let f32 = new Float32Array(1);
  let f32_u8 = new Uint8Array(f32.buffer);
  
  let f64 = new Float64Array(1);
  let f64_u8 = new Uint8Array(f64.buffer);
  
  function intToLong(value: number): Long {
    value |= 0;
    return {
      low: value,
      high: value >> 31,
      unsigned: value >= 0,
    };
  }
  
  let bbStack: ByteBuffer[] = [];
  
  function popByteBuffer(): ByteBuffer {
    const bb = bbStack.pop();
    if (!bb) return { bytes: new Uint8Array(64), offset: 0, limit: 0 };
    bb.offset = bb.limit = 0;
    return bb;
  }
  
  function pushByteBuffer(bb: ByteBuffer): void {
    bbStack.push(bb);
  }
  
  function wrapByteBuffer(bytes: Uint8Array): ByteBuffer {
    return { bytes, offset: 0, limit: bytes.length };
  }
  
  function toUint8Array(bb: ByteBuffer): Uint8Array {
    let bytes = bb.bytes;
    let limit = bb.limit;
    return bytes.length === limit ? bytes : bytes.subarray(0, limit);
  }
  
  function skip(bb: ByteBuffer, offset: number): void {
    if (bb.offset + offset > bb.limit) {
      throw new Error('Skip past limit');
    }
    bb.offset += offset;
  }
  
  function isAtEnd(bb: ByteBuffer): boolean {
    return bb.offset >= bb.limit;
  }
  
  function grow(bb: ByteBuffer, count: number): number {
    let bytes = bb.bytes;
    let offset = bb.offset;
    let limit = bb.limit;
    let finalOffset = offset + count;
    if (finalOffset > bytes.length) {
      let newBytes = new Uint8Array(finalOffset * 2);
      newBytes.set(bytes);
      bb.bytes = newBytes;
    }
    bb.offset = finalOffset;
    if (finalOffset > limit) {
      bb.limit = finalOffset;
    }
    return offset;
  }
  
  function advance(bb: ByteBuffer, count: number): number {
    let offset = bb.offset;
    if (offset + count > bb.limit) {
      throw new Error('Read past limit');
    }
    bb.offset += count;
    return offset;
  }
  
  function readBytes(bb: ByteBuffer, count: number): Uint8Array {
    let offset = advance(bb, count);
    return bb.bytes.subarray(offset, offset + count);
  }
  
  function writeBytes(bb: ByteBuffer, buffer: Uint8Array): void {
    let offset = grow(bb, buffer.length);
    bb.bytes.set(buffer, offset);
  }
  
  function readString(bb: ByteBuffer, count: number): string {
    // Sadly a hand-coded UTF8 decoder is much faster than subarray+TextDecoder in V8
    let offset = advance(bb, count);
    let fromCharCode = String.fromCharCode;
    let bytes = bb.bytes;
    let invalid = '\uFFFD';
    let text = '';
  
    for (let i = 0; i < count; i++) {
      let c1 = bytes[i + offset], c2: number, c3: number, c4: number, c: number;
  
      // 1 byte
      if ((c1 & 0x80) === 0) {
        text += fromCharCode(c1);
      }
  
      // 2 bytes
      else if ((c1 & 0xE0) === 0xC0) {
        if (i + 1 >= count) text += invalid;
        else {
          c2 = bytes[i + offset + 1];
          if ((c2 & 0xC0) !== 0x80) text += invalid;
          else {
            c = ((c1 & 0x1F) << 6) | (c2 & 0x3F);
            if (c < 0x80) text += invalid;
            else {
              text += fromCharCode(c);
              i++;
            }
          }
        }
      }
  
      // 3 bytes
      else if ((c1 & 0xF0) == 0xE0) {
        if (i + 2 >= count) text += invalid;
        else {
          c2 = bytes[i + offset + 1];
          c3 = bytes[i + offset + 2];
          if (((c2 | (c3 << 8)) & 0xC0C0) !== 0x8080) text += invalid;
          else {
            c = ((c1 & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F);
            if (c < 0x0800 || (c >= 0xD800 && c <= 0xDFFF)) text += invalid;
            else {
              text += fromCharCode(c);
              i += 2;
            }
          }
        }
      }
  
      // 4 bytes
      else if ((c1 & 0xF8) == 0xF0) {
        if (i + 3 >= count) text += invalid;
        else {
          c2 = bytes[i + offset + 1];
          c3 = bytes[i + offset + 2];
          c4 = bytes[i + offset + 3];
          if (((c2 | (c3 << 8) | (c4 << 16)) & 0xC0C0C0) !== 0x808080) text += invalid;
          else {
            c = ((c1 & 0x07) << 0x12) | ((c2 & 0x3F) << 0x0C) | ((c3 & 0x3F) << 0x06) | (c4 & 0x3F);
            if (c < 0x10000 || c > 0x10FFFF) text += invalid;
            else {
              c -= 0x10000;
              text += fromCharCode((c >> 10) + 0xD800, (c & 0x3FF) + 0xDC00);
              i += 3;
            }
          }
        }
      }
  
      else text += invalid;
    }
  
    return text;
  }
  
  function writeString(bb: ByteBuffer, text: string): void {
    // Sadly a hand-coded UTF8 encoder is much faster than TextEncoder+set in V8
    let n = text.length;
    let byteCount = 0;
  
    // Write the byte count first
    for (let i = 0; i < n; i++) {
      let c = text.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
        c = (c << 10) + text.charCodeAt(++i) - 0x35FDC00;
      }
      byteCount += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    writeVarint32(bb, byteCount);
  
    let offset = grow(bb, byteCount);
    let bytes = bb.bytes;
  
    // Then write the bytes
    for (let i = 0; i < n; i++) {
      let c = text.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
        c = (c << 10) + text.charCodeAt(++i) - 0x35FDC00;
      }
      if (c < 0x80) {
        bytes[offset++] = c;
      } else {
        if (c < 0x800) {
          bytes[offset++] = ((c >> 6) & 0x1F) | 0xC0;
        } else {
          if (c < 0x10000) {
            bytes[offset++] = ((c >> 12) & 0x0F) | 0xE0;
          } else {
            bytes[offset++] = ((c >> 18) & 0x07) | 0xF0;
            bytes[offset++] = ((c >> 12) & 0x3F) | 0x80;
          }
          bytes[offset++] = ((c >> 6) & 0x3F) | 0x80;
        }
        bytes[offset++] = (c & 0x3F) | 0x80;
      }
    }
  }
  
  function writeByteBuffer(bb: ByteBuffer, buffer: ByteBuffer): void {
    let offset = grow(bb, buffer.limit);
    let from = bb.bytes;
    let to = buffer.bytes;
  
    // This for loop is much faster than subarray+set on V8
    for (let i = 0, n = buffer.limit; i < n; i++) {
      from[i + offset] = to[i];
    }
  }
  
  function readByte(bb: ByteBuffer): number {
    return bb.bytes[advance(bb, 1)];
  }
  
  function writeByte(bb: ByteBuffer, value: number): void {
    let offset = grow(bb, 1);
    bb.bytes[offset] = value;
  }
  
  function readFloat(bb: ByteBuffer): number {
    let offset = advance(bb, 4);
    let bytes = bb.bytes;
  
    // Manual copying is much faster than subarray+set in V8
    f32_u8[0] = bytes[offset++];
    f32_u8[1] = bytes[offset++];
    f32_u8[2] = bytes[offset++];
    f32_u8[3] = bytes[offset++];
    return f32[0];
  }
  
  function writeFloat(bb: ByteBuffer, value: number): void {
    let offset = grow(bb, 4);
    let bytes = bb.bytes;
    f32[0] = value;
  
    // Manual copying is much faster than subarray+set in V8
    bytes[offset++] = f32_u8[0];
    bytes[offset++] = f32_u8[1];
    bytes[offset++] = f32_u8[2];
    bytes[offset++] = f32_u8[3];
  }
  
  function readDouble(bb: ByteBuffer): number {
    let offset = advance(bb, 8);
    let bytes = bb.bytes;
  
    // Manual copying is much faster than subarray+set in V8
    f64_u8[0] = bytes[offset++];
    f64_u8[1] = bytes[offset++];
    f64_u8[2] = bytes[offset++];
    f64_u8[3] = bytes[offset++];
    f64_u8[4] = bytes[offset++];
    f64_u8[5] = bytes[offset++];
    f64_u8[6] = bytes[offset++];
    f64_u8[7] = bytes[offset++];
    return f64[0];
  }
  
  function writeDouble(bb: ByteBuffer, value: number): void {
    let offset = grow(bb, 8);
    let bytes = bb.bytes;
    f64[0] = value;
  
    // Manual copying is much faster than subarray+set in V8
    bytes[offset++] = f64_u8[0];
    bytes[offset++] = f64_u8[1];
    bytes[offset++] = f64_u8[2];
    bytes[offset++] = f64_u8[3];
    bytes[offset++] = f64_u8[4];
    bytes[offset++] = f64_u8[5];
    bytes[offset++] = f64_u8[6];
    bytes[offset++] = f64_u8[7];
  }
  
  function readInt32(bb: ByteBuffer): number {
    let offset = advance(bb, 4);
    let bytes = bb.bytes;
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    );
  }
  
  function writeInt32(bb: ByteBuffer, value: number): void {
    let offset = grow(bb, 4);
    let bytes = bb.bytes;
    bytes[offset] = value;
    bytes[offset + 1] = value >> 8;
    bytes[offset + 2] = value >> 16;
    bytes[offset + 3] = value >> 24;
  }
  
  function readInt64(bb: ByteBuffer, unsigned: boolean): Long {
    return {
      low: readInt32(bb),
      high: readInt32(bb),
      unsigned,
    };
  }
  
  function writeInt64(bb: ByteBuffer, value: Long): void {
    writeInt32(bb, value.low);
    writeInt32(bb, value.high);
  }
  
  function readVarint32(bb: ByteBuffer): number {
    let c = 0;
    let value = 0;
    let b: number;
    do {
      b = readByte(bb);
      if (c < 32) value |= (b & 0x7F) << c;
      c += 7;
    } while (b & 0x80);
    return value;
  }
  
  function writeVarint32(bb: ByteBuffer, value: number): void {
    value >>>= 0;
    while (value >= 0x80) {
      writeByte(bb, (value & 0x7f) | 0x80);
      value >>>= 7;
    }
    writeByte(bb, value);
  }
  
  function readVarint64(bb: ByteBuffer, unsigned: boolean): Long {
    let part0 = 0;
    let part1 = 0;
    let part2 = 0;
    let b: number;
  
    b = readByte(bb); part0 = (b & 0x7F); if (b & 0x80) {
      b = readByte(bb); part0 |= (b & 0x7F) << 7; if (b & 0x80) {
        b = readByte(bb); part0 |= (b & 0x7F) << 14; if (b & 0x80) {
          b = readByte(bb); part0 |= (b & 0x7F) << 21; if (b & 0x80) {
  
            b = readByte(bb); part1 = (b & 0x7F); if (b & 0x80) {
              b = readByte(bb); part1 |= (b & 0x7F) << 7; if (b & 0x80) {
                b = readByte(bb); part1 |= (b & 0x7F) << 14; if (b & 0x80) {
                  b = readByte(bb); part1 |= (b & 0x7F) << 21; if (b & 0x80) {
  
                    b = readByte(bb); part2 = (b & 0x7F); if (b & 0x80) {
                      b = readByte(bb); part2 |= (b & 0x7F) << 7;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  
    return {
      low: part0 | (part1 << 28),
      high: (part1 >>> 4) | (part2 << 24),
      unsigned,
    };
  }
  
  function writeVarint64(bb: ByteBuffer, value: Long): void {
    let part0 = value.low >>> 0;
    let part1 = ((value.low >>> 28) | (value.high << 4)) >>> 0;
    let part2 = value.high >>> 24;
  
    // ref: src/google/protobuf/io/coded_stream.cc
    let size =
      part2 === 0 ?
        part1 === 0 ?
          part0 < 1 << 14 ?
            part0 < 1 << 7 ? 1 : 2 :
            part0 < 1 << 21 ? 3 : 4 :
          part1 < 1 << 14 ?
            part1 < 1 << 7 ? 5 : 6 :
            part1 < 1 << 21 ? 7 : 8 :
        part2 < 1 << 7 ? 9 : 10;
  
    let offset = grow(bb, size);
    let bytes = bb.bytes;
  
    switch (size) {
      case 10: bytes[offset + 9] = (part2 >>> 7) & 0x01;
      case 9: bytes[offset + 8] = size !== 9 ? part2 | 0x80 : part2 & 0x7F;
      case 8: bytes[offset + 7] = size !== 8 ? (part1 >>> 21) | 0x80 : (part1 >>> 21) & 0x7F;
      case 7: bytes[offset + 6] = size !== 7 ? (part1 >>> 14) | 0x80 : (part1 >>> 14) & 0x7F;
      case 6: bytes[offset + 5] = size !== 6 ? (part1 >>> 7) | 0x80 : (part1 >>> 7) & 0x7F;
      case 5: bytes[offset + 4] = size !== 5 ? part1 | 0x80 : part1 & 0x7F;
      case 4: bytes[offset + 3] = size !== 4 ? (part0 >>> 21) | 0x80 : (part0 >>> 21) & 0x7F;
      case 3: bytes[offset + 2] = size !== 3 ? (part0 >>> 14) | 0x80 : (part0 >>> 14) & 0x7F;
      case 2: bytes[offset + 1] = size !== 2 ? (part0 >>> 7) | 0x80 : (part0 >>> 7) & 0x7F;
      case 1: bytes[offset] = size !== 1 ? part0 | 0x80 : part0 & 0x7F;
    }
  }
  
  function readVarint32ZigZag(bb: ByteBuffer): number {
    let value = readVarint32(bb);
  
    // ref: src/google/protobuf/wire_format_lite.h
    return (value >>> 1) ^ -(value & 1);
  }
  
  function writeVarint32ZigZag(bb: ByteBuffer, value: number): void {
    // ref: src/google/protobuf/wire_format_lite.h
    writeVarint32(bb, (value << 1) ^ (value >> 31));
  }
  
  function readVarint64ZigZag(bb: ByteBuffer): Long {
    let value = readVarint64(bb, /* unsigned */ false);
    let low = value.low;
    let high = value.high;
    let flip = -(low & 1);
  
    // ref: src/google/protobuf/wire_format_lite.h
    return {
      low: ((low >>> 1) | (high << 31)) ^ flip,
      high: (high >>> 1) ^ flip,
      unsigned: false,
    };
  }
  
  function writeVarint64ZigZag(bb: ByteBuffer, value: Long): void {
    let low = value.low;
    let high = value.high;
    let flip = high >> 31;
  
    // ref: src/google/protobuf/wire_format_lite.h
    writeVarint64(bb, {
      low: (low << 1) ^ flip,
      high: ((high << 1) | (low >>> 31)) ^ flip,
      unsigned: false,
    });
  }
  