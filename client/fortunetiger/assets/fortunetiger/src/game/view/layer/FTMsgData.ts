// (1) 游戏流程 (10000以下的为大厅消息，10000以上的为游戏消息)
// 1：前端发送登录消息协议（101）,返回登录消息（102） 登录场景
// 2：登录成功后会转到大厅场景
// 3：大厅场景显示后，会自动发送获取房间列表消息（137）, 返回房间列表消息(138)
// 4：初始化房间列表UI，点中其中一个房间按钮会发送进入房间消息（143）, 返回可以进入房间的消息（144）（这个房间里的一些简单的公共信息）
// 5：收到进入房间的消息（144）后，大厅场景转到游戏场景
// 6：游戏场景显示后，会自动发送游戏准备消息（10501），返回游戏状态消息（10502），用于初始化下注列表和用户奖池列表
// 7: 玩家点击下注按钮时，会发送下注消息（10503），返回下注的游戏消息（10504）

import { FTNetConfig } from "../../net/FTNetConfig"






// (2) 断线重连
// 断线后自动发送登录消息（101）,返回可以进入房间的消息（144），由于没收到（10502），游戏初始化不了下注列表和用户奖池列表？

// (3) 心跳
// 客户端发送心跳消息（1），服务器返回心跳消息（2）

// 场景的对应文件
// game ZSLogin 
// hall ZSHall ZSHallLayer
// fbgame ZSGame ZSGameLayer


// 只保留小数点两位数，不同渠道的金币比例不一样
export let changeGold = (gold: number): number => {
    let gold_1 = Math.floor(gold * 100) / 100
    return gold_1 / 100
}

// 登录返回
export let LOGIN_DATA_102 = {
    "data": {
        "mSeatIndex": 0,
        "mAccount": "1338639",
        "mPassWord": "7elxtwzNPs_DgGVhXYhktKP2kXoOL28ATSG0cVsYw5aoQTjGhf7HfcKSQaeHznzfwLbr-SwAc3ygkAeJSs6JWx6sH21s3Otoo8X70HmB9PeLCePNMD_th1X4TKvdYGQTGubSp7zzNcAzr_jdI1Aq0Yu5E4HKg5v4ZoHBdwyQzhW_GvpqUtV6TPUDqgOetE_vOZhiC8YsPn2utILn-Dx67AgNWBP9AiCGV3YLeOUVTGM",
        "mIsBindPhone": true,
        "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDQ0ORNyMDkjcG5n.png",
        "mGameType": 0,
        "mGameTax": 0,
        "mIsMan": 0,
        "mUserID": 10125,
        "mCollectWebAward": 5000000,
        "mAgentID": 1,
        "mNewServerIp": "47.242.230.116",
        "mRoomID": 0,
        "mNickName": "User1338639",
        "mResult": 0,
        "mGameID": 0,
        "mDeskIndex": 0,
        "mBank": 0,
        "mPlayTime": 0,
        "mNewServerPort": 2192,
        "mMoney": 6981157100,
        "mSignature": "",
        "mIsSetBankPwd": false,
        "mTimeStamp": 1669970672
    },
    "id": 102
}

// 游戏结果
export let RESULT_DATA_10504 = {
    "id": 10504,
    "data": {
        "win_money_all": 15,
        "mFreeGameCount": 0,
        "now_odds": 1,
        "mBonusMoney": 0,
        "mFreeGameRotates": {},
        "mResult": 0,
        "now_odds_all": 50,
        "mBonusIndex": 0,
        "mMultipleIdx": 1,
        "mRotateData": {
            "mAwardList": [
                {
                    "mIconIdxs": [
                        11,
                        7,
                        8
                    ],
                    "flag_id": 1,
                    "mMoney": 5,
                    "mWinOdds": 5
                },
                {
                    "mIconIdxs": [
                        11,
                        7,
                        8,
                        4
                    ],
                    "flag_id": 1,
                    "mMoney": 10,
                    "mWinOdds": 10
                }
            ],
            "mFreeGameCount": 0,
            "mIcons": [
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9,
                9
            ]
        }
    }
}

// 免费游戏
export let RESULT_FREE_DATA_10504 = {
    "data": {
        "mFreeGameRotates": [
            {
                "mIcons": [
                    9,
                    8,
                    5,
                    11,
                    13,
                    9,
                    8,
                    7,
                    2,
                    3,
                    10,
                    2,
                    8,
                    2,
                    3
                ],
                "mAwardList": {},
                "mFreeGameCount": 6
            },
            {
                "mIcons": [
                    13,
                    12,
                    10,
                    3,
                    12,
                    4,
                    12,
                    2,
                    5,
                    12,
                    1,
                    12,
                    1,
                    8,
                    12
                ],
                "mAwardList": [
                    {
                        "flag_id": 1,
                        "mWinOdds": 5,
                        "mIconIdxs": [
                            11,
                            12,
                            13
                        ],
                        "mMoney": 5
                    },
                    {
                        "flag_id": 1,
                        "mWinOdds": 5,
                        "mIconIdxs": [
                            11,
                            7,
                            13
                        ],
                        "mMoney": 5
                    },
                    {
                        "flag_id": 1,
                        "mWinOdds": 5,
                        "mIconIdxs": [
                            11,
                            2,
                            13
                        ],
                        "mMoney": 5
                    },
                    {
                        "flag_id": 1,
                        "mWinOdds": 5,
                        "mIconIdxs": [
                            11,
                            7,
                            13
                        ],
                        "mMoney": 5
                    }
                ],
                "mFreeGameCount": 5,
                "mMoney": null,
                "mWinOdds": null
            },
            {
                "mIcons": [
                    6,
                    3,
                    7,
                    2,
                    8,
                    6,
                    10,
                    6,
                    1,
                    10,
                    9,
                    2,
                    9,
                    4,
                    6
                ],
                "mAwardList": {},
                "mFreeGameCount": 4
            },
            {
                "mIcons": [
                    5,
                    7,
                    1,
                    12,
                    8,
                    3,
                    3,
                    3,
                    3,
                    6,
                    10,
                    9,
                    5,
                    4,
                    5
                ],
                "mAwardList": [
                    {
                        "flag_id": 3,
                        "mWinOdds": 30,
                        "mIconIdxs": [
                            6,
                            7,
                            8,
                            9
                        ],
                        "mMoney": 30
                    }
                ],
                "mFreeGameCount": 3,
                "mMoney": null,
                "mWinOdds": null
            },
            {
                "mIcons": [
                    3,
                    3,
                    12,
                    9,
                    12,
                    2,
                    14,
                    12,
                    6,
                    12,
                    3,
                    6,
                    12,
                    13,
                    12
                ],
                "mAwardList": [
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            1,
                            2,
                            3
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            1,
                            2,
                            8
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            11,
                            2,
                            3
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            1,
                            2,
                            13
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            11,
                            2,
                            13
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            11,
                            2,
                            8
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            11,
                            2,
                            8
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            1,
                            2,
                            13
                        ],
                        "mMoney": 15
                    },
                    {
                        "flag_id": 3,
                        "mWinOdds": 15,
                        "mIconIdxs": [
                            1,
                            2,
                            8
                        ],
                        "mMoney": 15
                    }
                ],
                "mFreeGameCount": 2,
                "mMoney": null,
                "mWinOdds": null
            },
            {
                "mIcons": [
                    3,
                    12,
                    14,
                    7,
                    9,
                    4,
                    5,
                    4,
                    5,
                    5,
                    6,
                    6,
                    5,
                    3,
                    1
                ],
                "mAwardList": [
                    {
                        "flag_id": 4,
                        "mWinOdds": 20,
                        "mIconIdxs": [
                            6,
                            2,
                            8
                        ],
                        "mMoney": 20
                    }
                ],
                "mFreeGameCount": 1,
                "mMoney": null,
                "mWinOdds": null
            },
            {
                "mIcons": [
                    10,
                    1,
                    14,
                    13,
                    5,
                    8,
                    4,
                    8,
                    10,
                    2,
                    4,
                    6,
                    1,
                    6,
                    10
                ],
                "mAwardList": {},
                "mFreeGameCount": 0
            }
        ],
        "mRotateData": {
            "mIcons": [
                2,
                13,
                5,
                7,
                1,
                10,
                6,
                13,
                10,
                4,
                13,
                6,
                9,
                13,
                6
            ],
            "mAwardList": [
                {
                    "mIconIdxs": [
                        2,
                        8,
                        11,
                        14
                    ],
                    "mMoney": 0,
                    "mWinOdds": null
                }
            ],
            "mFreeGameCount": 0
        },
        "mResult": 0,
        "mBonusIndex": 0,
        "mFreeGameCount": 7,
        "now_odds_all": 50,
        "now_odds": 1,
        "mMultipleIdx": 1,
        "win_money_all": 205,
        "mBonusMoney": 0
    },
    "id": 10504
}

// 房间列表信息返回
export let ROOM_LIST_DATA_138 = {
    "id": 138,
    "data": {
        "mRoomList": [
            {
                "mRoomID": 1,
                "mLessMoney": 0,
                "mRoomType": 1,
                "mOddsMin": 0.5
            },
            {
                "mRoomID": 2,
                "mLessMoney": 1,
                "mRoomType": 2,
                "mOddsMin": 5
            },
            {
                "mRoomID": 3,
                "mLessMoney": 10,
                "mRoomType": 3,
                "mOddsMin": 50
            }
        ],
        "mGameID": 1002,
        "mResult": 0
    }
}

// 返回这个房间里的一些简单的公共信息
export let ENTER_GAME_DATA_144 = {
    id: 144,
    data: {
        "mGameID": 1002,
        "mGameType": 50,
        "mOddsMin": 1,
        "mDeskIndex": 36,
        "mResult": 0,
        "mSeatIndex": 1,
        "mRoomID": 3610015
    }
}

// 返回当前游戏状态信息（包括了用户奖池列表和）
export let GAME_CUR_INFO_10502 = {
    "data": {
        "mRankInfos": [
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User108330",
                "mMoney": 2990
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User115256",
                "mMoney": 1481
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User111657",
                "mMoney": 7636
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User104815",
                "mMoney": 3807
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User115741",
                "mMoney": 7486
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User116489",
                "mMoney": 7029
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User101932",
                "mMoney": 1652
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User120855",
                "mMoney": 321
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User110566",
                "mMoney": 583
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User113493",
                "mMoney": 4713
            },
            {
                "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png",
                "mNickName": "User125701",
                "mMoney": 9281
            }
        ],
        "mBonusList":
            374403,

        "mMultiples": [
            5000,
            10000,
            50000,
            100000,
            500000
        ]
    },
    "id": 10502
}


export let changeMsgGoldData = (data, msgid) => {


    switch (msgid) {
        case FTNetConfig.CMD.loginS2C: // 102 登录成功

            // {
            //     "mGameType": 0,
            //     "mNickName": "133863987652",
            //     "mMoney": 9990000,
            //     "mNewServerPort": 2192,
            //     "mIsBindPhone": true,
            //     "mIsSetBankPwd": false,
            //     "mRoomID": 0,
            //     "mTimeStamp": 1670588036,
            //     "mHeadIndex": "http://47.242.197.8/face/pic/6.png",
            //     "mAccount": "133863987652",
            //     "mSignature": "",
            //     "mResult": 0,
            //     "mUserID": 10887,
            //     "mNewServerIp": "190.92.234.115",
            //     "mAgentID": 1,
            //     "mGameID": 0,
            //     "mBank": 0,
            //     "mGameTax": 0,
            //     "mPassWord": "7elxtwz5aoQTjGhr-SA83362",
            //     "mDeskIndex": 0,
            //     "mIsMan": 1,
            //     "mPlayTime": 0,
            //     "mSeatIndex": 0,
            //     "mCollectWebAward": 0
            // }

            data.mMoney = changeGold(data.mMoney)

            break


        case FTNetConfig.CMD.requestEnterGameS2C: // 144 进入房间成功, 返回这个房间里的一些简单的公共信息
            // {
            //     "mResult": 0,
            //     "mGameID": 1002,
            //     "mRoomID": 3610015,
            //     "mOddsMin": 1,
            //     "mGameType": 50,
            //     "mSeatIndex": 1,
            //     "mDeskIndex": 36
            // }
            data.mGameType = changeGold(data.mGameType)
            break

        case FTNetConfig.CMD.requestOpenAwardS2C: // 10504 游戏结果
            // {
            //     "mResult": 0,
            //     "mBonusIndex": 0,
            //     "now_odds_all": 50,
            //     "win_money_all": 100,
            //     "mRotateData": {
            //         "mIcons": [
            //             4,
            //             4,
            //             4,
            //             3,
            //             10,
            //             1,
            //             7,
            //             4,
            //             7,
            //             3,
            //             13,
            //             2,
            //             11,
            //             3,
            //             5
            //         ],
            //         "mFreeGameCount": 0,
            //         "mAwardList": [
            //             {
            //                 "mMoney": 20,
            //                 "mWinOdds": 20,
            //                 "mIconIdxs": [
            //                     1,
            //                     2,
            //                     3
            //                 ],
            //                 "flag_id": 4
            //             },
            //             {
            //                 "mMoney": 20,
            //                 "mWinOdds": 20,
            //                 "mIconIdxs": [
            //                     1,
            //                     2,
            //                     8
            //                 ],
            //                 "flag_id": 4
            //             },
            //             {
            //                 "mMoney": 20,
            //                 "mWinOdds": 20,
            //                 "mIconIdxs": [
            //                     1,
            //                     2,
            //                     13
            //                 ],
            //                 "flag_id": 4
            //             },
            //             {
            //                 "mMoney": 20,
            //                 "mWinOdds": 20,
            //                 "mIconIdxs": [
            //                     1,
            //                     2,
            //                     13
            //                 ],
            //                 "flag_id": 4
            //             },
            //             {
            //                 "mMoney": 20,
            //                 "mWinOdds": 20,
            //                 "mIconIdxs": [
            //                     1,
            //                     2,
            //                     8
            //                 ],
            //                 "flag_id": 4
            //             }
            //         ]
            //     },
            //     "mFreeGameRotates": {},
            //     "mBonusMoney": 0,
            //     "now_odds": 1,
            //     "mFreeGameCount": 0,
            //     "mMultipleIdx": 1
            // }

            // data.now_odds_all = 
            // data.win_money_all = 
            // data.mRotateData = 
            let mAwardList = data.mRotateData.mAwardList
            for (let i = 0; i < mAwardList.length; i++) {
                let item = mAwardList[i]
                item.mMoney = changeGold(item.mMoney)
                item.mWinOdds = changeGold(item.mWinOdds)
            }

            let freeDataList = data.mFreeGameRotates
            if (freeDataList.length > 0) {

                for (let i = 0; i < freeDataList.length; i++) {
                    let item = freeDataList[i]
                    let item_mAwardList = item.mAwardList

                    for (let i = 0; i < item_mAwardList.length; i++) {
                        item.mMoney = changeGold(item.mMoney)
                        item.mWinOdds = changeGold(item.mWinOdds)
                    }
                }
            }
            break

        case FTNetConfig.CMD.getGameStateS2C: // 10502 返回当前游戏状态信息,游戏可以开始了
            // {
            //     "mRankInfos": [
            //         {
            //             "mMoney": 2225,
            //             "mNickName": "User118670",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 3642,
            //             "mNickName": "User129981",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 8933,
            //             "mNickName": "User100628",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 1074,
            //             "mNickName": "User114970",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 535,
            //             "mNickName": "User109292",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 8002,
            //             "mNickName": "User117882",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 8727,
            //             "mNickName": "User107119",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 2017,
            //             "mNickName": "User102967",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 8487,
            //             "mNickName": "User122166",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 8413,
            //             "mNickName": "User115948",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         },
            //         {
            //             "mMoney": 1327,
            //             "mNickName": "User115472",
            //             "mHeadIndex": "https://img.betluckydog.com/MTY2NDMzMzIzMDc4NRNxMjEjcG5n.png"
            //         }
            //     ],
            //     "mBonusList": [
            //         41540,
            //         200000,
            //         1000000,
            //         10000000
            //     ],
            //     "mMultiples": [
            //         50,
            //         100,
            //         500,
            //         1000,
            //         5000
            //     ]
            // }

            let tempmRankInfos = data.mRankInfos
            for (let i = 0; i < tempmRankInfos.length; i++) {
                let item = tempmRankInfos[i]
                item.mMoney = changeGold(item.mMoney)
            }

            let temp_mBonusList = data.mBonusList
            for (let i = 0; i < temp_mBonusList.length; i++) {
                temp_mBonusList[i] = changeGold(temp_mBonusList[i])
            }

            let mMultiples = data.mMultiples
            for (let i = 0; i < mMultiples.length; i++) {
                mMultiples[i] = changeGold(mMultiples[i])
            }
            break

        case FTNetConfig.CMD.requestRoomListS2C: // 138 房间列表
            // {
            //     "mGameID": 1002,
            //     "mResult": 0,
            //     "mRoomList": [
            //         {
            //             "mRoomType": 1,
            //             "mRoomID": 1,
            //             "mLessMoney": 0,
            //             "mOddsMin": 50
            //         },
            //         {
            //             "mRoomType": 2,
            //             "mRoomID": 2,
            //             "mLessMoney": 100,
            //             "mOddsMin": 500
            //         },
            //         {
            //             "mRoomType": 3,
            //             "mRoomID": 3,
            //             "mLessMoney": 1000,
            //             "mOddsMin": 5000
            //         }
            //     ]
            // }
            let mRoomList = data.mRoomList
            for (let i = 0; i < mRoomList.length; i++) {
                let item = mRoomList[i]
                item.mLessMoney = changeGold(item.mLessMoney)
                item.mOddsMin = changeGold(item.mOddsMin)
            }

            break

  

        case FTNetConfig.CMD.playerMoneyChangeS2C: // 131 服务器推送玩家的身上金币变化
            // {
            //     "mMoney": 9989980,
            //     "mUserID": 10987
            // }
            data.mMoney = changeGold(data.mMoney)
            break

        case FTNetConfig.CMD.requestLeaveGameS2C: // 146 收到离开消息

            break

        

        case FTNetConfig.CMD.heartBeatS2C: // websocket心跳
            // this.sendHeart() // 响应websocket心跳
            break
    }

    return data
}

export let normal1Data = {
    "data":{
        "mResult": 0,
        "moddsLevel": 1,
        "mMoney": {
            "low": 5130,
            "high": 0,
            "unsigned": false
        },
        "win_money_all": {
            "low": 3000,
            "high": 0,
            "unsigned": false
        },
        "isFree": 0,
        "mMultipleIdx": 1,
        "mRotateData": {
            "mFreeIconIdx": 1,
            "mFreeList": [
                {
                    "mFreeIcons": [
                        0,
                        0,
                        0,
                        0,
                        1,
                        0,
                        0,
                        0,
                        0
                    ]
                },
                {
                    "mFreeIcons": [
                        0,
                        0,
                        0,
                        1,
                        1,
                        0,
                        0,
                        0,
                        0
                    ]
                },
                {
                    "mFreeIcons": [
                        1,
                        0,
                        1,
                        1,
                        1,
                        0,
                        0,
                        0,
                        0
                    ]
                },
                {
                    "mFreeIcons": [
                        1,
                        1,
                        1,
                        1,
                        1,
                        0,
                        0,
                        1,
                        0
                    ]
                },
                {
                    "mFreeIcons": [
                        1,
                        1,
                        1,
                        1,
                        1,
                        0,
                        0,
                        1,
                        1
                    ]
                },
                {
                    "mFreeIcons": [
                        1,
                        1,
                        1,
                        1,
                        1,
                        1,
                        0,
                        1,
                        1
                    ]
                },
                {
                    "mFreeIcons": [
                        1,
                        1,
                        1,
                        1,
                        1,
                        1,
                        1,
                        1,
                        1
                    ]
                }
            ],
            "mAwardList": [
                {
                    "mWinOdds": 30,
                    "mIconIdxs": [
                        4,
                        5,
                        6
                    ],
                    "flag_id": 1,
                    "mMoney": {
                        "low": 3000,
                        "high": 0,
                        "unsigned": false
                    }
                },
                {
                    "mWinOdds": 30,
                    "mIconIdxs": [
                        7,
                        8,
                        9
                    ],
                    "flag_id": 2,
                    "mMoney": {
                        "low": 3000,
                        "high": 0,
                        "unsigned": false
                    }
                },
                {
                    "mWinOdds": 30,
                    "mIconIdxs": [
                        1,
                        2,
                        3
                    ],
                    "flag_id": 3,
                    "mMoney": {
                        "low": 3000,
                        "high": 0,
                        "unsigned": false
                    }
                },
                {
                    "mWinOdds": 30,
                    "mIconIdxs": [
                        7,
                        5,
                        3
                    ],
                    "flag_id": 4,
                    "mMoney": {
                        "low": 3000,
                        "high": 0,
                        "unsigned": false
                    }
                },
                {
                    "mWinOdds": 30,
                    "mIconIdxs": [
                        1,
                        5,
                        9
                    ],
                    "flag_id": 5,
                    "mMoney": {
                        "low": 3000,
                        "high": 0,
                        "unsigned": false
                    }
                }
            ]
        }
    }
}

export let normal2Data = {
    "data":{
        "win_money_all": {
            "low": 160,
            "high": 0,
            "unsigned": false
        },
        "mMultipleIdx": 2,
        "isFree": 0,
        "mResult": 0,
        "mMoney": {
            "low": 3864,
            "high": 0,
            "unsigned": false
        },
        "moddsLevel": 2,
        "mRotateData": {
            "mIcons": [
                3,
                7,
                7,
                7,
                4,
                4,
                4,
                5,
                1
            ],
            "mFreeIconIdx": 0,
            "mAwardList": [
                {
                    "flag_id": 1,
                    "mMoney": {
                        "low": 80,
                        "high": 0,
                        "unsigned": false
                    },
                    "mWinOdds": 10,
                    "mIconIdxs": [
                        4,
                        5,
                        6
                    ]
                },
                {
                    "flag_id": 4,
                    "mMoney": {
                        "low": 80,
                        "high": 0,
                        "unsigned": false
                    },
                    "mWinOdds": 10,
                    "mIconIdxs": [
                        7,
                        5,
                        3
                    ]
                }
            ]
        }
    }
}

export let normal3Data = {
    "data": {
        "mResult": 0,
        "mMoney": {
            "low": 4000,
            "high": 0,
            "unsigned": false
        },
        "mMultipleIdx": 2,
        "moddsLevel": 2,
        "isFree": 0,
        "win_money_all": {
            "low": 1200,
            "high": 0,
            "unsigned": false
        },
        "mRotateData": {
            "mIcons": [
                1,
                1,
                1,
                1,
                1,
                1,
                1,
                1,
                1
            ],
            "mFreeIconIdx": 0,
            "mAwardList": [
                {
                    "mIconIdxs": [
                        4,
                        5,
                        6
                    ],
                    "mMoney": {
                        "low": 1200,
                        "high": 0,
                        "unsigned": false
                    },
                    "flag_id": 1,
                    "mWinOdds": 30
                },
                {
                    "mIconIdxs": [
                        7,
                        8,
                        9
                    ],
                    "mMoney": {
                        "low": 1200,
                        "high": 0,
                        "unsigned": false
                    },
                    "flag_id": 2,
                    "mWinOdds": 30
                },
                {
                    "mIconIdxs": [
                        1,
                        2,
                        3
                    ],
                    "mMoney": {
                        "low": 1200,
                        "high": 0,
                        "unsigned": false
                    },
                    "flag_id": 3,
                    "mWinOdds": 30
                },
                {
                    "mIconIdxs": [
                        7,
                        5,
                        3
                    ],
                    "mMoney": {
                        "low": 1200,
                        "high": 0,
                        "unsigned": false
                    },
                    "flag_id": 4,
                    "mWinOdds": 30
                },
                {
                    "mIconIdxs": [
                        1,
                        5,
                        9
                    ],
                    "mMoney": {
                        "low": 1200,
                        "high": 0,
                        "unsigned": false
                    },
                    "flag_id": 5,
                    "mWinOdds": 30
                }
            ]
        }
    }
}