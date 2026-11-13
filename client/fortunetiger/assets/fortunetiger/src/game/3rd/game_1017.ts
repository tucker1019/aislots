export interface onceRotateInfo {
  mIcons?: number[];
  mAwardList?: awardIconInfo[];
  mFreeList?: mIconsInfo[];
  mFreeIconIdx: number;
}

export function encodeonceRotateInfo(message: onceRotateInfo): Uint8Array {
  let bb = popByteBuffer();
  _encodeonceRotateInfo(message, bb);
  return toUint8Array(bb);
}

function _encodeonceRotateInfo(message: onceRotateInfo, bb: ByteBuffer): void {
  // repeated int32 mIcons = 1;
  let array$mIcons = message.mIcons;
  if (array$mIcons !== undefined) {
    let packed = popByteBuffer();
    for (let value of array$mIcons) {
      writeVarint64(packed, intToLong(value));
    }
    writeVarint32(bb, 10);
    writeVarint32(bb, packed.offset);
    writeByteBuffer(bb, packed);
    pushByteBuffer(packed);
  }

  // repeated awardIconInfo mAwardList = 2;
  let array$mAwardList = message.mAwardList;
  if (array$mAwardList !== undefined) {
    for (let value of array$mAwardList) {
      writeVarint32(bb, 18);
      let nested = popByteBuffer();
      _encodeawardIconInfo(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // repeated mIconsInfo mFreeList = 3;
  let array$mFreeList = message.mFreeList;
  if (array$mFreeList !== undefined) {
    for (let value of array$mFreeList) {
      writeVarint32(bb, 26);
      let nested = popByteBuffer();
      _encodemIconsInfo(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // required int32 mFreeIconIdx = 4;
  let $mFreeIconIdx = message.mFreeIconIdx;
  if ($mFreeIconIdx !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, intToLong($mFreeIconIdx));
  }
}

export function decodeonceRotateInfo(binary: Uint8Array): onceRotateInfo {
  return _decodeonceRotateInfo(wrapByteBuffer(binary));
}

function _decodeonceRotateInfo(bb: ByteBuffer): onceRotateInfo {
  let message: onceRotateInfo = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // repeated int32 mIcons = 1;
      case 1: {
        let values = message.mIcons || (message.mIcons = []);
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

      // repeated awardIconInfo mAwardList = 2;
      case 2: {
        let limit = pushTemporaryLength(bb);
        let values = message.mAwardList || (message.mAwardList = []);
        values.push(_decodeawardIconInfo(bb));
        bb.limit = limit;
        break;
      }

      // repeated mIconsInfo mFreeList = 3;
      case 3: {
        let limit = pushTemporaryLength(bb);
        let values = message.mFreeList || (message.mFreeList = []);
        values.push(_decodemIconsInfo(bb));
        bb.limit = limit;
        break;
      }

      // required int32 mFreeIconIdx = 4;
      case 4: {
        message.mFreeIconIdx = readVarint32(bb);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  if (message.mFreeIconIdx === undefined)
    throw new Error("Missing required field: mFreeIconIdx");

  return message;
}

export interface mIconsInfo {
  mFreeIcons?: number[];
}

export function encodemIconsInfo(message: mIconsInfo): Uint8Array {
  let bb = popByteBuffer();
  _encodemIconsInfo(message, bb);
  return toUint8Array(bb);
}

function _encodemIconsInfo(message: mIconsInfo, bb: ByteBuffer): void {
  // repeated int32 mFreeIcons = 1;
  let array$mFreeIcons = message.mFreeIcons;
  if (array$mFreeIcons !== undefined) {
    let packed = popByteBuffer();
    for (let value of array$mFreeIcons) {
      writeVarint64(packed, intToLong(value));
    }
    writeVarint32(bb, 10);
    writeVarint32(bb, packed.offset);
    writeByteBuffer(bb, packed);
    pushByteBuffer(packed);
  }
}

export function decodemIconsInfo(binary: Uint8Array): mIconsInfo {
  return _decodemIconsInfo(wrapByteBuffer(binary));
}

function _decodemIconsInfo(bb: ByteBuffer): mIconsInfo {
  let message: mIconsInfo = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // repeated int32 mFreeIcons = 1;
      case 1: {
        let values = message.mFreeIcons || (message.mFreeIcons = []);
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

export interface awardIconInfo {
  mIconIdxs?: number[];
  mMoney?: Long;
  flag_id?: number;
  mWinOdds?: number;
}

export function encodeawardIconInfo(message: awardIconInfo): Uint8Array {
  let bb = popByteBuffer();
  _encodeawardIconInfo(message, bb);
  return toUint8Array(bb);
}

function _encodeawardIconInfo(message: awardIconInfo, bb: ByteBuffer): void {
  // repeated int32 mIconIdxs = 1;
  let array$mIconIdxs = message.mIconIdxs;
  if (array$mIconIdxs !== undefined) {
    let packed = popByteBuffer();
    for (let value of array$mIconIdxs) {
      writeVarint64(packed, intToLong(value));
    }
    writeVarint32(bb, 10);
    writeVarint32(bb, packed.offset);
    writeByteBuffer(bb, packed);
    pushByteBuffer(packed);
  }

  // optional int64 mMoney = 2;
  let $mMoney = message.mMoney;
  if ($mMoney !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $mMoney);
  }

  // optional int32 flag_id = 3;
  let $flag_id = message.flag_id;
  if ($flag_id !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, intToLong($flag_id));
  }

  // optional int32 mWinOdds = 4;
  let $mWinOdds = message.mWinOdds;
  if ($mWinOdds !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, intToLong($mWinOdds));
  }
}

export function decodeawardIconInfo(binary: Uint8Array): awardIconInfo {
  return _decodeawardIconInfo(wrapByteBuffer(binary));
}

function _decodeawardIconInfo(bb: ByteBuffer): awardIconInfo {
  let message: awardIconInfo = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // repeated int32 mIconIdxs = 1;
      case 1: {
        let values = message.mIconIdxs || (message.mIconIdxs = []);
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

      // optional int64 mMoney = 2;
      case 2: {
        message.mMoney = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int32 flag_id = 3;
      case 3: {
        message.flag_id = readVarint32(bb);
        break;
      }

      // optional int32 mWinOdds = 4;
      case 4: {
        message.mWinOdds = readVarint32(bb);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface getGameStateC2S {
}

export function encodegetGameStateC2S(message: getGameStateC2S): Uint8Array {
  let bb = popByteBuffer();
  _encodegetGameStateC2S(message, bb);
  return toUint8Array(bb);
}

function _encodegetGameStateC2S(message: getGameStateC2S, bb: ByteBuffer): void {
}

export function decodegetGameStateC2S(binary: Uint8Array): getGameStateC2S {
  return _decodegetGameStateC2S(wrapByteBuffer(binary));
}

function _decodegetGameStateC2S(bb: ByteBuffer): getGameStateC2S {
  let message: getGameStateC2S = {} as any;

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

export interface getGameStateS2C {
  mMultiples?: number[];
  mMoney: Long;
}

export function encodegetGameStateS2C(message: getGameStateS2C): Uint8Array {
  let bb = popByteBuffer();
  _encodegetGameStateS2C(message, bb);
  return toUint8Array(bb);
}

function _encodegetGameStateS2C(message: getGameStateS2C, bb: ByteBuffer): void {
  // repeated int32 mMultiples = 1;
  let array$mMultiples = message.mMultiples;
  if (array$mMultiples !== undefined) {
    let packed = popByteBuffer();
    for (let value of array$mMultiples) {
      writeVarint64(packed, intToLong(value));
    }
    writeVarint32(bb, 10);
    writeVarint32(bb, packed.offset);
    writeByteBuffer(bb, packed);
    pushByteBuffer(packed);
  }

  // required int64 mMoney = 2;
  let $mMoney = message.mMoney;
  if ($mMoney !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $mMoney);
  }
}

export function decodegetGameStateS2C(binary: Uint8Array): getGameStateS2C {
  return _decodegetGameStateS2C(wrapByteBuffer(binary));
}

function _decodegetGameStateS2C(bb: ByteBuffer): getGameStateS2C {
  let message: getGameStateS2C = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // repeated int32 mMultiples = 1;
      case 1: {
        let values = message.mMultiples || (message.mMultiples = []);
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

      // required int64 mMoney = 2;
      case 2: {
        message.mMoney = readVarint64(bb, /* unsigned */ false);
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

export interface requestOpenAwardC2S {
  mMultipleIdx: number;
  isFree: number;
  moddsLevel: number;
}

export function encoderequestOpenAwardC2S(message: requestOpenAwardC2S): Uint8Array {
  let bb = popByteBuffer();
  _encoderequestOpenAwardC2S(message, bb);
  return toUint8Array(bb);
}

function _encoderequestOpenAwardC2S(message: requestOpenAwardC2S, bb: ByteBuffer): void {
  // required int32 mMultipleIdx = 1;
  let $mMultipleIdx = message.mMultipleIdx;
  if ($mMultipleIdx !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, intToLong($mMultipleIdx));
  }

  // required int32 isFree = 2;
  let $isFree = message.isFree;
  if ($isFree !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, intToLong($isFree));
  }

  // required int32 moddsLevel = 3;
  let $moddsLevel = message.moddsLevel;
  if ($moddsLevel !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, intToLong($moddsLevel));
  }
}

export function decoderequestOpenAwardC2S(binary: Uint8Array): requestOpenAwardC2S {
  return _decoderequestOpenAwardC2S(wrapByteBuffer(binary));
}

function _decoderequestOpenAwardC2S(bb: ByteBuffer): requestOpenAwardC2S {
  let message: requestOpenAwardC2S = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // required int32 mMultipleIdx = 1;
      case 1: {
        message.mMultipleIdx = readVarint32(bb);
        break;
      }

      // required int32 isFree = 2;
      case 2: {
        message.isFree = readVarint32(bb);
        break;
      }

      // required int32 moddsLevel = 3;
      case 3: {
        message.moddsLevel = readVarint32(bb);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  if (message.mMultipleIdx === undefined)
    throw new Error("Missing required field: mMultipleIdx");

  if (message.isFree === undefined)
    throw new Error("Missing required field: isFree");

  if (message.moddsLevel === undefined)
    throw new Error("Missing required field: moddsLevel");

  return message;
}

export interface requestOpenAwardS2C {
  mResult: number;
  mMultipleIdx: number;
  mRotateData: onceRotateInfo;
  mMoney: Long;
  win_money_all: Long;
  isFree: number;
  moddsLevel: number;
}

export function encoderequestOpenAwardS2C(message: requestOpenAwardS2C): Uint8Array {
  let bb = popByteBuffer();
  _encoderequestOpenAwardS2C(message, bb);
  return toUint8Array(bb);
}

function _encoderequestOpenAwardS2C(message: requestOpenAwardS2C, bb: ByteBuffer): void {
  // required int32 mResult = 1;
  let $mResult = message.mResult;
  if ($mResult !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, intToLong($mResult));
  }

  // required int32 mMultipleIdx = 2;
  let $mMultipleIdx = message.mMultipleIdx;
  if ($mMultipleIdx !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, intToLong($mMultipleIdx));
  }

  // required onceRotateInfo mRotateData = 3;
  let $mRotateData = message.mRotateData;
  if ($mRotateData !== undefined) {
    writeVarint32(bb, 26);
    let nested = popByteBuffer();
    _encodeonceRotateInfo($mRotateData, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // required int64 mMoney = 4;
  let $mMoney = message.mMoney;
  if ($mMoney !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, $mMoney);
  }

  // required int64 win_money_all = 5;
  let $win_money_all = message.win_money_all;
  if ($win_money_all !== undefined) {
    writeVarint32(bb, 40);
    writeVarint64(bb, $win_money_all);
  }

  // required int32 isFree = 6;
  let $isFree = message.isFree;
  if ($isFree !== undefined) {
    writeVarint32(bb, 48);
    writeVarint64(bb, intToLong($isFree));
  }

  // required int32 moddsLevel = 7;
  let $moddsLevel = message.moddsLevel;
  if ($moddsLevel !== undefined) {
    writeVarint32(bb, 56);
    writeVarint64(bb, intToLong($moddsLevel));
  }
}

export function decoderequestOpenAwardS2C(binary: Uint8Array): requestOpenAwardS2C {
  return _decoderequestOpenAwardS2C(wrapByteBuffer(binary));
}

function _decoderequestOpenAwardS2C(bb: ByteBuffer): requestOpenAwardS2C {
  let message: requestOpenAwardS2C = {} as any;

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

      // required int32 mMultipleIdx = 2;
      case 2: {
        message.mMultipleIdx = readVarint32(bb);
        break;
      }

      // required onceRotateInfo mRotateData = 3;
      case 3: {
        let limit = pushTemporaryLength(bb);
        message.mRotateData = _decodeonceRotateInfo(bb);
        bb.limit = limit;
        break;
      }

      // required int64 mMoney = 4;
      case 4: {
        message.mMoney = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // required int64 win_money_all = 5;
      case 5: {
        message.win_money_all = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // required int32 isFree = 6;
      case 6: {
        message.isFree = readVarint32(bb);
        break;
      }

      // required int32 moddsLevel = 7;
      case 7: {
        message.moddsLevel = readVarint32(bb);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  if (message.mResult === undefined)
    throw new Error("Missing required field: mResult");

  if (message.mMultipleIdx === undefined)
    throw new Error("Missing required field: mMultipleIdx");

  if (message.mRotateData === undefined)
    throw new Error("Missing required field: mRotateData");

  if (message.mMoney === undefined)
    throw new Error("Missing required field: mMoney");

  if (message.win_money_all === undefined)
    throw new Error("Missing required field: win_money_all");

  if (message.isFree === undefined)
    throw new Error("Missing required field: isFree");

  if (message.moddsLevel === undefined)
    throw new Error("Missing required field: moddsLevel");

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
