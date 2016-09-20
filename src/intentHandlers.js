/**
    Copyright 2016 Valorie Dodge. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located

    in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

'use strict';
var textHelper = require('./textHelper'),
    storage = require('./storage'),
    express = require('express'),
    request = require('request');

var app = express();

var GA_TRACKING_ID = 'UA-83204288-2';


var registerIntentHandlers = function (intentHandlers, skillContext) {
    //Keep an array of the children to keep logs for, to avoid mis-recognition when adding activity
    intentHandlers.AddChildIntent = function (intent, session, response) {
        //add a child to keep logs of daily activities
        var newChildName = intent.slots.ChildName.value;
        if (!newChildName) {
            response.ask('OK. What is the name of the child you would like to keep logs for?', 'What is your child\'s name?');
            return;
        }
        storage.loadLogs(session, function (currentLogs) {
            var speechOutput,
                reprompt;
            if (!currentLogs.data.names) {
                currentLogs.data.names = [];
            } else if (currentLogs.data.names[0]) {
              if (currentLogs.hasName(newChildName)) {
                  speechOutput = newChildName + ' has already been added to your logs.';
                  if (skillContext.needMoreHelp) {
                      response.ask(speechOutput + ' What would you like to do?', 'What would you like to do?');
                  } else {
                      response.ask(speechOutput + ' What would you like to do?', 'What would you like to do?');
                  }
                  return;
              }
            }
            speechOutput = newChildName + ' has been added to your logs. ';
            currentLogs.data.names.push(newChildName);
            trackEvent(
              'Intent',
              'AddChildIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.ask(speechOutput + "Would you like to log anything else?", reprompt);
            });
        });
    };

    //Remove a child's name for array
    intentHandlers.RemoveChildIntent = function (intent, session, response) {
        var childName = intent.slots.ChildName.value;
        if (!childName) {
            response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
            return;
        }

        storage.loadLogs(session, function (currentLogs) {
            var speechOutput = '', currentTime = new Date(), index;
            //check to see if child's name has been added to account
            //if not currently in account return to user
            if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
                return;
            }
            index = currentLogs.data.names.indexOf(childName);
            currentLogs.data.names.splice(index, 1);
            speechOutput += childName + " has been removed from your logs."
            trackEvent(
              'Intent',
              'RemoveChildIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };

    //Log what time a child goes down for a nap or down to bed
    intentHandlers.AddSleepIntent = function (intent, session, response) {
        //log when a child goes down for a nap, ask additional question if slot values are missing.
        var childName = intent.slots.ChildName.value;
        if (!childName) {
            response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
            return;
        }

        storage.loadLogs(session, function (currentLogs) {
            var speechOutput = '', currentTime = new Date(), newNapArray = [], currentIndex;
            //check to see if child's name has been added to account
            //if not currently in account return to user to avoid multiple mis-entries
            if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
                return;
            }
            if (!currentLogs.data.naps[childName]) {
                currentLogs.data.naps[childName] = [];
                newNapArray[0] = currentTime;
                currentLogs.data.naps[childName][0] = newNapArray;
            } else {
                currentIndex = currentLogs.data.naps[childName].length;
                newNapArray[0] = currentTime;
                currentLogs.data.naps[childName][currentIndex] = [];
                currentLogs.data.naps[childName][currentIndex] = newNapArray;
            }

            speechOutput += childName + " went to sleep at " + formatTime(currentTime) + ' has been added. You can also log when ' + childName + ' wakes up to track the length of the sleep time. ';
            trackEvent(
              'Intent',
              'AddSleepIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };
    //Tell last time a child has a record for going to sleep (whether they are still sleeping or not)
    intentHandlers.TellLastSleepIntent = function (intent, session, response) {
        //log when a child goes down for a nap, ask additional question if slot values are missing.
        var childName = intent.slots.ChildName.value;
        if (!childName) {
            response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
            return;
        }

        storage.loadLogs(session, function (currentLogs) {
            var speechOutput = '', currentTime = new Date(), currentIndex, lastSleep;
            //check to see if child's name has been added to account
            //if not currently in account return to user to avoid multiple mis-entries
            if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
                return;
            }
            //check for sleep activity from DB, if no data return to user
            if (!currentLogs.data.naps || !currentLogs.data.naps[childName] || !currentLogs.data.naps[childName][0]) {
                response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
                return;
            }

            //otherwise get last logged sleep datetime object and format for output
            currentIndex = currentLogs.data.naps[childName].length -1;
            // console.log(currentIndex);
            lastSleep = currentLogs.data.naps[childName][currentIndex][0];
            // console.log(lastSleep);
            var lastSleepTime = formatTime(new Date(lastSleep));
            var timeDifference = getTimeDifference(new Date(lastSleep), currentTime);
            var lastSleepTimePassed = formatTimeDifference(timeDifference);

            speechOutput += childName + " went to sleep at " + lastSleepTime + '. ' + lastSleepTimePassed + ' ago. ';
            trackEvent(
              'Intent',
              'TellLastSleepIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };
    //Tell last time a child woke up for the last sleep record
    intentHandlers.TellLastWakeIntent = function (intent, session, response) {
        //log when a child goes down for a nap, ask additional question if slot values are missing.
        var childName = intent.slots.ChildName.value;
        if (!childName) {
            response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
            return;
        }

        storage.loadLogs(session, function (currentLogs) {
            var speechOutput = '', currentTime = new Date(), currentIndex, lastWake;
            //check to see if child's name has been added to account
            //if not currently in account return to user to avoid multiple mis-entries
            if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
                return;
            }
            //check for sleep activity from DB, if no data return to user
            if (!currentLogs.data.naps || !currentLogs.data.naps[childName] || !currentLogs.data.naps[childName][0]) {
                response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
                return;
            }

            //otherwise get last logged sleep datetime object and format for output
            currentIndex = currentLogs.data.naps[childName].length -1;
            if (!currentLogs.data.naps[childName][currentIndex][1]) {
                response.ask('Sorry, I do not have a wake up time logged for ' + childName + ' for the last sleep recorded. What would you like to do?', childName + ' does not have a wake up time logged for the last sleep. What would you like to do?');
                return;
            }
            lastWake = currentLogs.data.naps[childName][currentIndex][1];
            var lastWakeTime = formatTime(new Date(lastWake));
            var timeDifference = getTimeDifference(new Date(lastWake), currentTime);
            var lastWakeTimePassed = formatTimeDifference(timeDifference);

            speechOutput += childName + " woke up at " + lastWakeTime + '. ' + lastWakeTimePassed + ' ago. ';
            trackEvent(
              'Intent',
              'TellLastWakeIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };
    //Tell how long a child slept for the last sleep record (only if sleep and wake time were both recorded)
    intentHandlers.HowLongAsleepIntent = function (intent, session, response) {
      //log when a child goes down for a nap, ask additional question if slot values are missing.
      var childName = intent.slots.ChildName.value;
      if (!childName) {
          response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
          return;
      }

      storage.loadLogs(session, function (currentLogs) {
          var speechOutput = '', currentTime = new Date(), currentIndex;
          //check to see if child's name has been added to account
          //if not currently in account return to user to avoid multiple mis-entries
          if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
              return;
          }
          //check for sleep activity from DB, if no data return to user
          if (!currentLogs.data.naps || !currentLogs.data.naps[childName] || !currentLogs.data.naps[childName][0]) {
              response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
              return;
          }
          //otherwise get last logged sleep datetime object
          currentIndex = currentLogs.data.naps[childName].length - 1;

          //Check to see if the last sleep entered already has a corresponding wake up event
          if (!currentLogs.data.naps[childName][currentIndex][0] || !currentLogs.data.naps[childName][currentIndex][1]) {
              var lastLog = currentLogs.data.naps[childName][currentIndex][0];
              var temp = formatDate(new Date(lastLog)) + ' ' + formatTime(new Date(lastLog));
              response.ask('Sorry, I do not have a wake up time for ' +  childName + ' for the last sleep recorded. Last activity was recorded ' + temp + '. What would you like to do?', childName + ' does not have a wake up time recorded for the last recorded sleep. What would you like to do?');
              return;
          }

          //Find time difference between last wake time and last sleep time and format output
          var lastSleep = currentLogs.data.naps[childName][currentIndex][0];
          var lastWake = currentLogs.data.naps[childName][currentIndex][1];
          var timePassed = getTimeDifference(new Date(lastSleep), new Date(lastWake));
          var sleepTimePassed = formatTimeDifference(timePassed);

          speechOutput += childName + ' slept for ' + sleepTimePassed + '. ';
          trackEvent(
            'Intent',
            'HowLongAsleepIntent',
            'na',
            '100', // Event value must be numeric.
            function(err) {
              if (err) {
                  var speechOutput = err;
                  response.tell(speechOutput);
              }
            });
          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };
    //Add when a child wakes up to last sleep record
    intentHandlers.WakeUpIntent = function (intent, session, response) {
      //log when a child goes down for a nap, ask additional question if slot values are missing.
      var childName = intent.slots.ChildName.value;
      if (!childName) {
          response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
          return;
      }

      storage.loadLogs(session, function (currentLogs) {
          var speechOutput = '', currentTime = new Date(), currentIndex, lastSleep, sleepArray;
          //check to see if child's name has been added to account
          //if not currently in account return to user to avoid multiple mis-entries
          if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
              return;
          }
          //check for sleep activity from DB, if no data return to user
          if (!currentLogs.data.naps || !currentLogs.data.naps[childName] || !currentLogs.data.naps[childName][0]) {
              response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
              return;
          }

          //otherwise get last logged sleep datetime object
          currentIndex = currentLogs.data.naps[childName].length - 1;

          if (!currentLogs.data.naps[childName][currentIndex][0]) {
              response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
              return;
          }

          //Check to see if the last sleep entered already has a corresponding wake up event
          if (currentLogs.data.naps[childName][currentIndex][0] && currentLogs.data.naps[childName][currentIndex][1]) {
              var lastLog = currentLogs.data.naps[childName][currentIndex][1];
              var temp = formatDate(new Date(lastLog)) + ' ' + formatTime(new Date(lastLog));
              response.ask('Sorry, I do not have any new sleep activity logged for ' + childName + '. Last activity was logged ' + temp + '. What would you like to do?', childName + ' does not have any new sleep activity logged. What would you like to do?');
              return;
          }

          //Set current time as wake time in nap array
          currentLogs.data.naps[childName][currentIndex][1] = currentTime;
          lastSleep = currentLogs.data.naps[childName][currentIndex][0];
          var timePassed = getTimeDifference(new Date(lastSleep), currentTime);
          var sleepTimePassed = formatTimeDifference(timePassed);

          speechOutput += childName + " woke up at " + formatTime(currentTime) + '. Sleeping for ' + sleepTimePassed + '. ';
          trackEvent(
            'Intent',
            'WakeUpIntent',
            'na',
            '100', // Event value must be numeric.
            function(err) {
              if (err) {
                  var speechOutput = err;
                  response.tell(speechOutput);
              }
            });
          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };


    //Add a record for time of feeding
    intentHandlers.AddFeedingIntent = function (intent, session, response) {
        //log when a child goes down for a nap, ask additional question if slot values are missing.
        var childName = intent.slots.ChildName.value;
        // var nursingSide = intent.slots.NursingSide.value;
        // var feedingAmount = intent.slots.FeedingAmount.value;
        if (!childName) {
            response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
            return;
        }

        storage.loadLogs(session, function (currentLogs) {
            var speechOutput = '', currentTime = new Date(), newFeedingArray = [], currentIndex;
            //check to see if child's name has been added to account
            //if not currently in account return to user to avoid multiple mis-entries
            if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
                return;
            }
            if (!currentLogs.data.feedings[childName]) {
                currentLogs.data.feedings[childName] = [];
                newFeedingArray[0] = currentTime;
                currentLogs.data.feedings[childName][0] = newFeedingArray;
            } else {
                currentIndex = currentLogs.data.feedings[childName].length;
                newFeedingArray[0] = currentTime;
                currentLogs.data.feedings[childName][currentIndex] = [];
                currentLogs.data.feedings[childName][currentIndex] = newFeedingArray;
            }

            speechOutput += childName + " ate at " + formatTime(currentTime) + ' added. ';
            if (currentLogs.data.feedings[childName].length < 2) {
                speechOutput += 'If you are nursing, you can also log when ' + childName + ' stops eating to track the length of the feeding time. ';
            }
            trackEvent(
              'Intent',
              'AddFeedingIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };
    //Return time of last feeding record
    intentHandlers.TellLastFeedingIntent = function (intent, session, response) {
        //log when a child goes down for a nap, ask additional question if slot values are missing.
        var childName = intent.slots.ChildName.value;
        if (!childName) {
            response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
            return;
        }

        storage.loadLogs(session, function (currentLogs) {
            var speechOutput = '', currentTime = new Date(), currentIndex, lastFeeding;
            //check to see if child's name has been added to account
            //if not currently in account return to user to avoid multiple mis-entries
            if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
                return;
            }
            //check for feeding activity from DB, if no data return to user
            if (!currentLogs.data.feedings || !currentLogs.data.feedings[childName] || !currentLogs.data.feedings[childName][0]) {
                response.ask('Sorry, I do not have any feedings logged for ' + childName + '. What would you like to do?', childName + ' does not have any feedings logged. What would you like to do?');
                return;
            }

            //otherwise get last logged feeding datetime object and format for output
            currentIndex = currentLogs.data.feedings[childName].length -1;
            // console.log(currentIndex);
            lastFeeding = currentLogs.data.feedings[childName][currentIndex][0];
            // console.log(lastFeeding);
            var lastFeedingTime = formatTime(new Date(lastFeeding));
            var timeDifference = getTimeDifference(new Date(lastFeeding), new Date(currentTime));
            var lastFeedingTimePassed = formatTimeDifference(timeDifference);

            speechOutput += childName + " ate at " + lastFeedingTime + ' ' + lastFeedingTimePassed + ' ago. ';
            trackEvent(
              'Intent',
              'TellLastFeedingIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };
    //Return how long from last recorded feeding
    intentHandlers.HowLongFeedingIntent = function (intent, session, response) {
      //log when a child goes down for a nap, ask additional question if slot values are missing.
      var childName = intent.slots.ChildName.value;
      if (!childName) {
          response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
          return;
      }

      storage.loadLogs(session, function (currentLogs) {
          var speechOutput = '', currentTime = new Date(), currentIndex;
          //check to see if child's name has been added to account
          //if not currently in account return to user to avoid multiple mis-entries
          if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
              return;
          }
          //check for feeding activity from DB, if no data return to user
          if (!currentLogs.data.feedings || !currentLogs.data.feedings[childName] || !currentLogs.data.feedings[childName][0]) {
              response.ask('Sorry, I do not have any feedings logged for ' + childName + '. What would you like to do?', childName + ' does not have any feedings logged. What would you like to do?');
              return;
          }
          //otherwise get last logged feeding datetime object
          currentIndex = currentLogs.data.feedings[childName].length - 1;

          //Check to see if the last feedin entered already has a corresponding wake up event
          if (!currentLogs.data.feedings[childName][currentIndex][0] || !currentLogs.data.feedings[childName][currentIndex][1]) {
              var lastLog = currentLogs.data.feedings[childName][currentIndex][0];
              var temp = formatDate(new Date(lastLog)) + ' ' + formatTime(new Date(lastLog));
              response.ask('Sorry, I do not know when you stopped feeding ' +  childName + ' for the last feeding recorded. Last activity was recorded ' + temp + '. What would you like to do?', childName + ' does not have a stopped eating time recorded for the last recorded feeding. What would you like to do?');
              return;
          }

          //Find time difference between last stop feeding time and last start feeding time and format output
          var lastFeeding = currentLogs.data.feedings[childName][currentIndex][0];
          var lastStoppedFeeding = currentLogs.data.feedings[childName][currentIndex][1];
          var timePassed = getTimeDifference(new Date(lastFeeding), new Date(lastStoppedFeeding));
          var feedingTimePassed = formatTimeDifference(timePassed);

          speechOutput += childName + ' ate for ' + feedingTimePassed + ' at ' + formatTime(new Date(lastFeeding));
          trackEvent(
            'Intent',
            'HowLongFeedingIntent',
            'na',
            '100', // Event value must be numeric.
            function(err) {
              if (err) {
                  var speechOutput = err;
                  response.tell(speechOutput);
              }
            });
          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };
    //Log stop time for feeding
    intentHandlers.StopFeedingIntent = function (intent, session, response) {
      //log when a child goes down for a nap, ask additional question if slot values are missing.
      var childName = intent.slots.ChildName.value;
      if (!childName) {
          response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
          return;
      }

      storage.loadLogs(session, function (currentLogs) {
          var speechOutput = '', currentTime = new Date(), currentIndex, lastFeeding, feedingArray;
          //check to see if child's name has been added to account
          //if not currently in account return to user to avoid multiple mis-entries
          if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
              return;
          }
          //check for feeding activity from DB, if no data return to user
          if (!currentLogs.data.feedings || !currentLogs.data.feedings[childName] || !currentLogs.data.feedings[childName][0]) {
              response.ask('Sorry, I do not have any feedings logged for ' + childName + '. What would you like to do?', childName + ' does not have any feedings logged. What would you like to do?');
              return;
          }

          //otherwise get last logged feeding datetime object
          currentIndex = currentLogs.data.feedings[childName].length - 1;

          if (!currentLogs.data.feedings[childName][currentIndex][0]) {
              response.ask('Sorry, I do not have any feedings logged for ' + childName + '. What would you like to do?', childName + ' does not have any feedings logged. What would you like to do?');
              return;
          }

          //Check to see if the last feeding entered already has a corresponding stop feeding recorded
          if (currentLogs.data.feedings[childName][currentIndex][0] && currentLogs.data.feedings[childName][currentIndex][1]) {
              var lastLog = currentLogs.data.feedings[childName][currentIndex][1];
              var temp = formatDate(new Date(lastLog)) + ' ' + formatTime(new Date(lastLog));
              response.ask('Sorry, I do not have any new feedings logged for ' + childName + '. Last activity was logged ' + temp + '. What would you like to do?', childName + ' does not have any new feedings logged. What would you like to do?');
              return;
          }

          //Set current time as stop feeding time in feedings array

          currentLogs.data.feedings[childName][currentIndex][1] = currentTime;
          lastFeeding = currentLogs.data.feedings[childName][currentIndex][0];
          var timePassed = getTimeDifference(new Date(lastFeeding), currentTime);
          var feedingTimePassed = formatTimeDifference(timePassed);

          speechOutput += childName + " woke up at " + formatTime(currentTime) + ' eating for ' + feedingTimePassed + '. ';
          trackEvent(
            'Intent',
            'StopFeedingIntent',
            'na',
            '100', // Event value must be numeric.
            function(err) {
              if (err) {
                  var speechOutput = err;
                  response.tell(speechOutput);
              }
            });
          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };
    //Create a record for a dirty diaper
    intentHandlers.DiaperIntent = function (intent, session, response) {
        //log when a child goes down for a nap, ask additional question if slot values are missing.
        var childName = intent.slots.ChildName.value;
        var diaperType = intent.slots.DiaperType.value;
        // var feedingAmount = intent.slots.FeedingAmount.value;
        if (!childName) {
            response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
            return;
        }

        storage.loadLogs(session, function (currentLogs) {
            var speechOutput = '', currentTime = new Date(), newDiaperArray = [], currentIndex;
            //check to see if child's name has been added to account
            //if not currently in account return to user to avoid multiple mis-entries
            if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
                return;
            }

            if (!currentLogs.data.diapers[childName]) {
                currentLogs.data.diapers[childName] = [];
                currentIndex = 0;
            } else {
                currentIndex = currentLogs.data.diapers[childName].length;
            }

            newDiaperArray[0] = currentTime;
            if (diaperType && (diaperType === "poopy")){
              newDiaperArray[1] = 1;
            } else {
              newDiaperArray[1] = 0;
            }
            // currentLogs.data.diapers[childName][currentIndex] = [];
            currentLogs.data.diapers[childName][currentIndex] = newDiaperArray;

            speechOutput += childName + " had a ";
            if(diaperType && (diaperType === "poopy")){
              speechOutput += "poopy";
            } else {
              speechOutput += "wet";
            }
            speechOutput += " diaper at " + formatTime(currentTime) + ' added. ';
            if (currentLogs.data.diapers[childName].length < 2) {
                speechOutput += 'You can specify between poopy and wet diapers by saying: ' + childName + ' had a poopy diaper. Or ' + childName + ' had a wet diaper. The default is a wet diaper. ';
            }
            trackEvent(
              'Intent',
              'DiaperIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };
    //Return how many dirty diapers recorded in the past twenty-four hours
    intentHandlers.HowManyDiapersIntent = function (intent, session, response) {
      //get slot values, ask additional question if slot values are missing.
      var childName = intent.slots.ChildName.value;
      var diaperType = intent.slots.DiaperType.value;
      if (!childName) {
          response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
          return;
      }

      storage.loadLogs(session, function (currentLogs) {
          var speechOutput = '', currentTime = new Date(), currentIndex, today = true, poopyCount = 0, wetCount = 0;
          //check to see if child's name has been added to account
          //if not currently in account return to user to avoid multiple mis-entries
          if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
              return;
          }
          //check for dirty diaper logs from DB, if no data return to user
          if (!currentLogs.data.diapers || !currentLogs.data.diapers[childName] || !currentLogs.data.diapers[childName][0]) {
              response.ask('Sorry, I do not have any diapers logged for ' + childName + '. What would you like to do?', childName + ' does not have any diapers logged. What would you like to do?');
              return;
          }
          //store arrray of diaper logs for child and get last logged diaper object
          var myChildLogs = currentLogs.data.diapers[childName];
          currentIndex = myChildLogs.length - 1;

          //Count how many entries within the last 24 hours are wet and how many are poopy
          while (currentIndex >= 0){
              var loggedDiaperDate = new Date(myChildLogs[currentIndex][0]);
              if (withinLastDay(loggedDiaperDate)){
                if (myChildLogs[currentIndex][1] === 1) {
                  poopyCount += 1;
                } else {
                  wetCount += 1;
                }
                currentIndex -= 1;
              } else {
                currentIndex = -1;
              }
          }
          speechOutput += childName + " has had ";
          if (poopyCount > 0) {
            speechOutput += poopyCount + " poopy diaper";
            if (poopyCount > 1){
              speechOutput += "s";
            }
          }
          if (poopyCount > 0 && wetCount > 0) {
            speechOutput += " and ";
          } else if (poopyCount === 0 && wetCount === 0) {
            speechOutput += " no dirty diapers";
          }
          if (wetCount > 0) {
            speechOutput += wetCount + " wet diaper";
            if (wetCount > 1){
              speechOutput += "s";
            }
          }
          speechOutput += " recorded in the last twenty-four hours.";
          trackEvent(
            'Intent',
            'HowManyDiapersIntent',
            'na',
            '100', // Event value must be numeric.
            function(err) {
              if (err) {
                  var speechOutput = err;
                  response.tell(speechOutput);
              }
            });
          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };

    intentHandlers.ClearAllLogsIntent = function (intent, session, response) {
        //remove due date
        storage.newLogs(session).save(function () {
            trackEvent(
              'Intent',
              'ClearAllLogsIntent',
              'na',
              '100', // Event value must be numeric.
              function(err) {
                if (err) {
                    var speechOutput = err;
                    response.tell(speechOutput);
                }
              });
            response.tell('All records have been removed.');
        });
    };

    intentHandlers['AMAZON.HelpIntent'] = function (intent, session, response) {
        var speechOutput = textHelper.completeHelp;
        if (skillContext.needMoreHelp) {
            response.ask(textHelper.completeHelp + ' So, how can I help?', 'How can I help?');
        } else {
            response.ask(textHelper.completeHelp);
        }
    };

    intentHandlers['AMAZON.CancelIntent'] = function (intent, session, response) {
        if (skillContext.needMoreHelp) {
            response.tell('Okay.  Whenever you\'re ready, you can log your child\'s activities.');
        } else {
            response.tell('');
        }
    };

    intentHandlers['AMAZON.StopIntent'] = function (intent, session, response) {
        if (skillContext.needMoreHelp) {
            response.tell('Okay.  Whenever you\'re ready, you can log your child\'s activities.');
        } else {
            response.tell('');
        }
    };
};

//Returns time difference between two datetime objects in milliseconds
function getTimeDifference(date1, date2) {
    var timediff = date2 - date1;
    if (isNaN(timediff)) return NaN;
    if (timediff < 0) return undefined;
    return timediff;
}

//Formats time difference given in milliseconds to hours and minutes string
function formatTimeDifference(timediff) {
    var second=1000, minute=second*60, hour=minute*60, day=hour*24, week=day*7, interval, difference, hours, minutes;
    hours = Math.floor(timediff/hour);
    minutes = Math.floor((timediff % hour)/minute);
    var answer = "";
    if (hours === 1){
      answer += hours + " hour";
    } else if (hours > 1) {
      answer += hours + " hours";
    }
    if (minutes > 0 && hours > 0){
      answer += " and ";
      if (minutes < 10){
        answer += "0";
      }
    }
    if (minutes > 1) {
      answer += minutes + " minutes";
    } else if (minutes === 1){
      answer += minutes + " minute";
    }
    return answer;
}

//Returns just hours and minutes from datetime object with am or pm
function formatTime(myDate){
  var hours = myDate.getHours();
  var minutes = myDate.getMinutes();
  var answer = "";
  if (hours > 12) {
     answer += (hours - 12) + ":";
     if (minutes < 10){
       answer += "0";
     }
     answer += minutes + " p.m.";
  } else {
    answer += hours + ":";
    if (minutes < 10){
      answer += "0";
    }
    answer += minutes + " p.m.";
  }
  return answer;
}

//Returns YYYY/DD/MM from datetime object
function formatDate(mydate) {
  var month = mydate.getMonth() + 1; //months from 1-12
  var day = mydate.getDate();
  var year = mydate.getFullYear();
  return year + "/" + month + "/" + day;
}

//Check to see if the input value for child name is valid
//returns true if the input value is found
// function checkForChildName(name, response) {
//   if (!name) {
//       response.ask('sorry, I did not hear the child\'s name, please say that again', 'Please say the name again');
//       return true;
//   } else {
//       return false;
//   }
// }

//check to see if child name has already been added to logs to avoid inadvertantly logging activity under two names
//returns true if child name is not found
// function checkForChildName(currentLogs, childName, response) {
//   if (!currentLogs.data.names || !currentLogs.hasName(childName)) {
//       response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your logs. What would you like to do?');
//       return true;
//   } else {
//       return false;
//   }
// }

//returns true if the given date is within the last twenty-four hours
function withinLastDay(checkDate) {
  var second=1000, minute=second*60, hour=minute*60, day=hour*24;
  var today = new Date();
  var timediff = today - checkDate;
  if (isNaN(timediff)) return NaN;
  if (timediff < day) {
    return true;
  } else {
    return false;
  }
}

//Track events with google-analytics
function trackEvent(category, action, label, value, callback) {
  var data = {
    v: '1', // API Version.
    tid: GA_TRACKING_ID, // Tracking ID / Property ID.
    // Anonymous Client Identifier. Ideally, this should be a UUID that
    // is associated with particular user, device, or browser instance.
    cid: '555',
    t: 'event', // Event hit type.
    ec: category, // Event category.
    ea: action, // Event action.
    el: label, // Event label.
    ev: value, // Event value.
  };

  request.post(
    'http://www.google-analytics.com/collect', {
      form: data
    },
    function(err, response) {
      if (err) { return callback(err); }
      if (response.statusCode !== 200) {
        return callback(new Error('Tracking failed'));
      }
      callback();
    }
  );
}


exports.register = registerIntentHandlers;
