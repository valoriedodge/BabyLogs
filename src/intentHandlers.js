/**
    Copyright 2016 Valorie Dodge. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located

    in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

'use strict';
var textHelper = require('./textHelper'),
    storage = require('./storage');

var registerIntentHandlers = function (intentHandlers, skillContext) {
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

            currentLogs.save(function () {
                response.ask(speechOutput + "Would you like to log anything else?", reprompt);
            });
        });
    };

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

            speechOutput += childName + " went to sleep at " + formatTime(currentTime) + ' has been logged. You can also log when ' + childName + ' wakes up to track the length of the sleep time. ';

            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };

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
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your log files. What would you like to do?');
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
            var timeDifference = getTimeDifference(new Date(lastSleep), new Date(currentTime));
            var lastSleepTimePassed = formatTimeDifference(timeDifference);

            speechOutput += childName + " went to sleep at " + lastSleepTime + ' ' + lastSleepTimePassed + ' ago. ';

            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };

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
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your log files. What would you like to do?');
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

          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };

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
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your log files. What would you like to do?');
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
          var timePassed = getTimeDifference(new Date(lastSleep), new Date(currentTime));
          var sleepTimePassed = formatTimeDifference(timePassed);

          speechOutput += childName + " woke up at " + formatTime(currentTime) + ' sleeping for ' + sleepTimePassed + '. ';

          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };
    intentHandlers.AddFeedingIntent = function (intent, session, response) {
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
            if (!currentLogs.data.feedings[childName]) {
                currentLogs.data.feedings[childName] = [];
                newFeedingArray[0] = currentTime;
                currentLogs.data.feedings[childName][0] = newNapArray;
            } else {
                currentIndex = currentLogs.data.feedings[childName].length;
                newFeedingArray[0] = currentTime;
                currentLogs.data.feedings[childName][currentIndex] = [];
                currentLogs.data.feedings[childName][currentIndex] = newNapArray;
            }

            speechOutput += childName + " went to sleep at " + formatTime(currentTime) + ' has been logged. You can also log when ' + childName + ' wakes up to track the length of the sleep time. ';

            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };

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
                response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your log files. What would you like to do?');
                return;
            }
            //check for sleep activity from DB, if no data return to user
            if (!currentLogs.data.feedings || !currentLogs.data.feedings[childName] || !currentLogs.data.feedings[childName][0]) {
                response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
                return;
            }

            //otherwise get last logged sleep datetime object and format for output
            currentIndex = currentLogs.data.feedings[childName].length -1;
            // console.log(currentIndex);
            lastSleep = currentLogs.data.feedings[childName][currentIndex][0];
            // console.log(lastSleep);
            var lastSleepTime = formatTime(new Date(lastSleep));
            var timeDifference = getTimeDifference(new Date(lastSleep), new Date(currentTime));
            var lastSleepTimePassed = formatTimeDifference(timeDifference);

            speechOutput += childName + " went to sleep at " + lastSleepTime + ' ' + lastSleepTimePassed + ' ago. ';

            currentLogs.save(function () {
                response.tell(speechOutput);
            });
        });
    };

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
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your log files. What would you like to do?');
              return;
          }
          //check for sleep activity from DB, if no data return to user
          if (!currentLogs.data.feedings || !currentLogs.data.feedings[childName] || !currentLogs.data.feedings[childName][0]) {
              response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
              return;
          }
          //otherwise get last logged sleep datetime object
          currentIndex = currentLogs.data.feedings[childName].length - 1;

          //Check to see if the last sleep entered already has a corresponding wake up event
          if (!currentLogs.data.feedings[childName][currentIndex][0] || !currentLogs.data.feedings[childName][currentIndex][1]) {
              var lastLog = currentLogs.data.feedings[childName][currentIndex][0];
              var temp = formatDate(new Date(lastLog)) + ' ' + formatTime(new Date(lastLog));
              response.ask('Sorry, I do not have a wake up time for ' +  childName + ' for the last sleep recorded. Last activity was recorded ' + temp + '. What would you like to do?', childName + ' does not have a wake up time recorded for the last recorded sleep. What would you like to do?');
              return;
          }

          //Find time difference between last wake time and last sleep time and format output
          var lastSleep = currentLogs.data.feedings[childName][currentIndex][0];
          var lastWake = currentLogs.data.feedings[childName][currentIndex][1];
          var timePassed = getTimeDifference(new Date(lastSleep), new Date(lastWake));
          var sleepTimePassed = formatTimeDifference(timePassed);

          speechOutput += childName + ' slept for ' + sleepTimePassed + '. ';

          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };

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
              response.ask('Sorry, ' + childName + ' has not been added to your log files. What would you like to do?', childName + ' has not been added to your log files. What would you like to do?');
              return;
          }
          //check for sleep activity from DB, if no data return to user
          if (!currentLogs.data.feedings || !currentLogs.data.feedings[childName] || !currentLogs.data.feedings[childName][0]) {
              response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
              return;
          }

          //otherwise get last logged sleep datetime object
          currentIndex = currentLogs.data.feedings[childName].length - 1;

          if (!currentLogs.data.feedings[childName][currentIndex][0]) {
              response.ask('Sorry, I do not have any sleep activity logged for ' + childName + '. What would you like to do?', childName + ' does not have any sleep activity logged. What would you like to do?');
              return;
          }

          //Check to see if the last sleep entered already has a corresponding wake up event
          if (currentLogs.data.feedings[childName][currentIndex][0] && currentLogs.data.feedings[childName][currentIndex][1]) {
              var lastLog = currentLogs.data.feedings[childName][currentIndex][1];
              var temp = formatDate(new Date(lastLog)) + ' ' + formatTime(new Date(lastLog));
              response.ask('Sorry, I do not have any new sleep activity logged for ' + childName + '. Last activity was logged ' + temp + '. What would you like to do?', childName + ' does not have any new sleep activity logged. What would you like to do?');
              return;
          }

          //Set current time as wake time in nap array

          currentLogs.data.feedings[childName][currentIndex][1] = currentTime;
          lastSleep = currentLogs.data.feedings[childName][currentIndex][0];
          var timePassed = getTimeDifference(new Date(lastSleep), new Date(currentTime));
          var sleepTimePassed = formatTimeDifference(timePassed);

          speechOutput += childName + " woke up at " + formatTime(currentTime) + ' sleeping for ' + sleepTimePassed + '. ';

          currentLogs.save(function () {
              response.tell(speechOutput);
          });
       });
    };

    // intentHandlers.ResetPlayersIntent = function (intent, session, response) {
    //     //remove all players
    //     storage.newGame(session).save(function () {
    //         response.ask('New game started without players, who do you want to add first?', 'Who do you want to add first?');
    //     });
    // };

    intentHandlers['AMAZON.HelpIntent'] = function (intent, session, response) {
        var speechOutput = textHelper.completeHelp;
        if (skillContext.needMoreHelp) {
            response.ask(textHelper.completeHelp + ' So, how can I help?', 'How can I help?');
        } else {
            response.tell(textHelper.completeHelp);
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


exports.register = registerIntentHandlers;
