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

angular.module('mm.addons.mod_imscp')

/**
 * IMSCP factory.
 *
 * @module mm.addons.mod_imscp
 * @ngdoc service
 * @name $mmaModImscp
 */
.factory('$mmaModImscp', function($mmFilepool, $mmSite, $mmUtil, $mmFS, $log, $q, mmaModImscpComponent) {
    $log = $log.getInstance('$mmaModImscp');

    var self = {},
        currentDirPath; // Directory path of the current IMSCP.

    /**
     * Get the IMSCP toc as an array.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#getToc
     * @param  {array} contents The module contents.
     * @return {Array}          The toc.
     * @protected
     */
    self.getToc = function(contents) {
        return JSON.parse(contents[0].content);
    };

    /**
     * Get the imscp toc as an array of items (no nested) to build the navigation tree.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#createItemList
     * @param  {array} contents The module contents.
     * @return {Array}          The toc as a list.
     * @protected
     */
    self.createItemList = function(contents) {
        var items = [];
        var toc = self.getToc(contents);
        angular.forEach(toc, function(el) {
            items.push({href: el.href, title: el.title, level: el.level});
            angular.forEach(el.subitems, function(sel) {
                items.push({href: sel.href, title: sel.title, level: sel.level});
            });
        });
        return items;
    };

    /**
     * Get the previous item to the given one.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#getPreviousItem
     * @param  {array} items     The items list.
     * @param  {String} itemId   The current item.
     * @return {String}          The previous item id.
     * @protected
     */
    self.getPreviousItem = function(items, itemId) {
        var previous = '';

        for (var i = 0, len = items.length; i < len; i++) {
            if (items[i].href == itemId) {
                break;
            }
            previous = items[i].href;
        }

        return previous;
    };

    /**
     * Get the next item to the given one.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#getNextItem
     * @param  {array} items     The items list.
     * @param  {String} itemId   The current item.
     * @return {String}           The next item id.
     * @protected
     */
    self.getNextItem = function(items, itemId) {
        var next = '';

        for (var i = 0, len = items.length; i < len; i++) {
            if (items[i].href == itemId) {
                if (typeof items[i + 1] != 'undefined') {
                    next = items[i + 1].href;
                    break;
                }
            }
        }
        return next;
    };


    /**
     * Check if we should ommit the file download.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#checkSpecialFiles
     * @param {String} fileName The file name
     * @return {Boolean}        True if we should ommit the file
     * @protected
     */
    self.checkSpecialFiles = function(fileName) {
        return fileName == 'imsmanifest.xml';
    };

    /**
     * Download all the content. All the files are downloaded inside a folder in filepool, keeping their folder structure.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#downloadAllContent
     * @param {Object} module The module object.
     * @return {Promise}      Promise resolved when content is downloaded. Data returned is not reliable.
     */
    self.downloadAllContent = function(module) {
        var promises = [],
            siteId = $mmSite.getId();

        // Get path of the module folder in filepool.
        return $mmFilepool.getFilePathByUrl(siteId, module.url).then(function(dirPath) {
            angular.forEach(module.contents, function(content) {
                var fullpath,
                    url,
                    modified;

                if (content.type !== 'file') {
                    return;
                }

                // Special case for IMSCP packages.
                if (self.checkSpecialFiles(content.filename)) {
                    return;
                }

                url = content.fileurl;
                modified = content.timemodified;
                fullpath = content.filename;
                if (content.filepath !== '/') {
                    fullpath = content.filepath.substr(1) + fullpath;
                }
                fullpath = $mmFS.concatenatePaths(dirPath, fullpath);

                promises.push($mmFilepool.downloadUrl(siteId, url, false, mmaModImscpComponent, module.id, modified, fullpath));
            });

            return $q.all(promises);
        });
    };

    /**
     * Get event names of files being downloaded.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#getDownloadingFilesEventNames
     * @param {Object} module The module object returned by WS.
     * @return {Promise} Resolved with an array of event names.
     */
    self.getDownloadingFilesEventNames = function(module) {
        var promises = [],
            eventNames = [],
            notDownloaded = 0,
            downloading = 0,
            outdated = 0,
            downloaded = 0,
            fileCount = 0,
            siteid = $mmSite.getId();

        angular.forEach(module.contents, function(content) {
            var url = content.fileurl;
            if (content.type !== 'file') {
                return;
            }
            if (self.checkSpecialFiles(content.filename)) {
                return;
            }
            promises.push($mmFilepool.isFileDownloadingByUrl(siteid, url).then(function() {
                return $mmFilepool.getFileEventNameByUrl(siteid, url).then(function(eventName) {
                    eventNames.push(eventName);
                });
            }, function() {
                // Ignore fails.
            }));
        });

        return $q.all(promises).then(function() {
            return eventNames;
        });
    };

    /**
     * Returns a list of file event names.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#getFileEventNames
     * @param {Object} module The module object returned by WS.
     * @return {Promise} Promise resolved with array of $mmEvent names.
     */
    self.getFileEventNames = function(module) {
        var promises = [];
        angular.forEach(module.contents, function(content) {
            var url = content.fileurl;
            if (content.type !== 'file') {
                return;
            }

            // Special case for IMSCP packages.
            if (self.checkSpecialFiles(content.filename)) {
                return;
            }

            promises.push($mmFilepool.getFileEventNameByUrl($mmSite.getId(), url));
        });
        return $q.all(promises).then(function(eventNames) {
            return eventNames;
        });
    };

    /**
     * Download all the files needed and returns the src of the iframe.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#getIframeSrc
     * @param {Object} module The module object.
     * @return {Promise}      Promise resolved with the iframe src.
     */
    self.getIframeSrc = function(module) {
        var toc = self.getToc(module.contents);
        var mainFilePath = toc[0].href;

        return self.downloadAllContent(module).then(function() {
            return $mmFilepool.getDirectoryUrlByUrl($mmSite.getId(), module.url).then(function(dirPath) {
                currentDirPath = dirPath;
                return $mmFS.concatenatePaths(dirPath, mainFilePath);
            });
        });
    };

    /**
     * Get src of a imscp item.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#getFileSrc
     * @param {String} moduleurl The module url.
     * @param {String} itemId    Item to get the src.
     * @return {String}          Item src.
     */
    self.getFileSrc = function(moduleurl, itemId) {
        return $mmFS.concatenatePaths(currentDirPath, itemId);
    };

    /**
     * Invalidate the prefetched content.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#invalidateContent
     * @param {Number} moduleId The module ID.
     * @return {Promise}
     */
    self.invalidateContent = function(moduleId) {
        return $mmFilepool.invalidateFilesByComponent($mmSite.getId(), mmaModImscpComponent, moduleId);
    };

    /**
     * Report the imscp as being viewed.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#logView
     * @param {Number} instanceId The instance ID of the module.
     * @return {Void}
     */
    self.logView = function(instanceId) {
        if (instanceId) {
            $mmSite.write('mod_imscp_view_imscp', {
                imscpid: instanceId
            });
        }
    };

    /**
     * Prefetch the content. All the files are downloaded inside a folder in filepool, keeping their folder structure.
     *
     * @module mm.addons.mod_imscp
     * @ngdoc method
     * @name $mmaModImscp#prefetchContent
     * @param {Object} module The module object returned by WS.
     * @return {Void}
     */
    self.prefetchContent = function(module) {
        var siteId = $mmSite.getId();
        // Get path of the module folder in filepool.
        $mmFilepool.getFilePathByUrl(siteId, module.url).then(function(dirPath) {
            angular.forEach(module.contents, function(content) {
                var fullpath,
                    url,
                    modified;
                if (content.type !== 'file') {
                    return;
                }
                // Special case for IMSCP packages.
                if (self.checkSpecialFiles(content.filename)) {
                    return;
                }
                url = content.fileurl;
                modified = content.timemodified;
                fullpath = content.filename;
                if (content.filepath !== '/') {
                    fullpath = content.filepath.substr(1) + fullpath;
                }
                fullpath = $mmFS.concatenatePaths(dirPath, fullpath);

                $mmFilepool.addToQueueByUrl(siteId, url, mmaModImscpComponent, module.id, modified, fullpath);
            });
        });
    };

    return self;
});
