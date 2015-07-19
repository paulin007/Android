// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module('mm.addons.messages', [])

.constant('mmaMessagesPollInterval', 5000)
.value('mmaMessagesPriority', 600)
.value('mmaMessagesSendMessagePriority', 1000)
.value('mmaMessagesAddContactPriority', 800)
.value('mmaMessagesBlockContactPriority', 600)

.config(function($stateProvider) {

    $stateProvider

    .state('site.messages', {
        url: '/messages',
        views: {
            'site': {
                templateUrl: 'addons/messages/templates/index.html'
            }
        }
    })

    .state('site.messages-discussion', {
        url: '/messages-discussion',
        params: {
            userId: null,
            userFullname: null
        },
        views: {
            'site': {
                templateUrl: 'addons/messages/templates/discussion.html',
                controller: 'mmaMessagesDiscussionCtrl'
            }
        }
    });

})

.run(function($mmSideMenuDelegate, $mmaMessages, $mmUserDelegate, $mmaMessagesHandlers, $mmEvents, $state, $mmAddonManager,
            $mmUtil, mmCoreEventLogin, mmaMessagesPriority, mmaMessagesSendMessagePriority, mmaMessagesAddContactPriority,
            mmaMessagesBlockContactPriority) {

    $mmSideMenuDelegate.registerPlugin('mmaMessages', function() {

        if (!$mmaMessages.isPluginEnabled()) {
            return;
        }

        return $mmaMessages.isMessagingEnabled().then(function() {
            return {
                icon: 'ion-chatbox',
                state: 'site.messages',
                title: 'mma.messages.messages'
            };
        });

    }, mmaMessagesPriority);

    $mmUserDelegate.registerPlugin('mmaMessages:sendMessage', $mmaMessagesHandlers.sendMessage, mmaMessagesSendMessagePriority);
    $mmUserDelegate.registerPlugin('mmaMessages:addContact', $mmaMessagesHandlers.addContact, mmaMessagesAddContactPriority);
    $mmUserDelegate.registerPlugin('mmaMessages:blockContact', $mmaMessagesHandlers.blockContact, mmaMessagesBlockContactPriority);

    // Invalidate messaging enabled WS calls.
    $mmEvents.on(mmCoreEventLogin, function() {
        $mmaMessages.invalidateEnabledCache();
    });

    // Register push notification clicks.
    var $mmPushNotificationsDelegate = $mmAddonManager.get('$mmPushNotificationsDelegate');
    if ($mmPushNotificationsDelegate) {
        $mmPushNotificationsDelegate.registerHandler('mmaMessages', function(notification) {
            if ($mmUtil.isFalseOrZero(notification.notif)) {
                $mmaMessages.isMessagingEnabledForSite(notification.site).then(function() {
                    $mmaMessages.invalidateDiscussionsCache().finally(function() {
                        $state.go('redirect', {siteid: notification.site, state: 'site.messages'});
                    });
                });
                return true;
            }
        });
    }

});
