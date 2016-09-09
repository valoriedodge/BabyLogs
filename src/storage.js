/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

'use strict';
var AWS = require("aws-sdk");

var storage = (function () {
    var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

    /*
     * The Log class stores all log states for the user
     */
    function Logs(session, data) {
        if (data) {
            this.data = data;
        } else {
            this.data = {
                names: [],
                naps: {},
                feedings: {}
            };
        }
        this._session = session;
    }

    Logs.prototype = {
        hasName: function (nameToCheck) {
            //check if any one had non-zero score,
            //it can be used as an indication of whether the game has just started
            var answer = false;
            var logData = this.data;
            logData.names.forEach(function (name) {
                if (name === nameToCheck) {
                    answer = true;
                }
            });
            return answer;
        },
        save: function (callback) {
            //save the game states in the session,
            //so next time we can save a read from dynamoDB
            this._session.attributes.currentLogs = this.data;
            dynamodb.putItem({
                TableName: 'BabyLogsUserData',
                Item: {
                    CustomerId: {
                        S: this._session.user.userId
                    },
                    Data: {
                        S: JSON.stringify(this.data)
                    }
                }
            }, function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                }
                if (callback) {
                    callback();
                }
            });
        }
    };

    return {
        loadLogs: function (session, callback) {
            if (session.attributes.currentLogs) {
                console.log('get logs from session=' + session.attributes.currentLogs);
                callback(new Logs(session, session.attributes.currentLogs));
                return;
            }
            dynamodb.getItem({
                TableName: 'BabyLogsUserData',
                Key: {
                    CustomerId: {
                        S: session.user.userId
                    }
                }
            }, function (err, data) {
                var currentLogs;
                if (err) {
                    console.log(err, err.stack);
                    currentLogs = new Logs(session);
                    session.attributes.currentLogs = currentLogs.data;
                    callback(currentLogs);
                } else if (data.Item === undefined) {
                    currentLogs = new Logs(session);
                    session.attributes.currentLogs = currentLogs.data;
                    callback(currentLogs);
                } else {
                    console.log('get logs from dynamodb=' + data.Item.Data.S);
                    currentLogs = new Logs(session, JSON.parse(data.Item.Data.S));
                    session.attributes.currentLogs = currentLogs.data;
                    callback(currentLogs);
                }
            });
        },
        newLogs: function (session) {
            return new Logs(session);
        }
    };
})();
module.exports = storage;
