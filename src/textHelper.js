/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

'use strict';
var textHelper = (function () {
    var nameBlacklist = {
        player: 1,
        players: 1
    };

    return {
        completeHelp: 'Here\'s some things you can say,'
        + ' add mary.'
        + ' mary is going down for a nap.'
        + ' mary just woke up from a nap.'
        + ' how long has mary been sleeping?'
        + ' how long was Mary\'s last nap?'
        + ' mary is eating.'
        + ' I am nursing mary.'
        + ' Mary finished eating.'
        + ' When did Mary eat last'
        + ' Mary had a dirty diaper'
        + ' Mary had a poopy diaper'
        + ' How many dirty diapers has mary had'
        + ' and exit.',
        nextHelp: 'You can add a child to track daily activities for, log when you put a child down for a nap, when they wake up, when you feed them, or when they have a dirty diaper. You can also always say help. What would you like?',

        getChildName: function (recognizedName) {
            if (!recognizedName) {
                return undefined;
            }
            var split = recognizedName.indexOf(' '), newName;

            if (split < 0) {
                newName = recognizedName;
            } else {
                //the name should only contain a first name, so ignore the second part if any
                newName = recognizedName.substring(0, split);
            }
            if (nameBlacklist[newName]) {
                //if the name is on our blacklist, it must be mis-recognition
                return undefined;
            }
            return newName;
        }
    };
})();
module.exports = textHelper;
