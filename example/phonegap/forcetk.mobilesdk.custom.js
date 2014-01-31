/*
 * Copyright (c) 2013, salesforce.com, inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided
 * that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of conditions and the
 * following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and
 * the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * Neither the name of salesforce.com, inc. nor the names of its contributors may be used to endorse or
 * promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

(function ($j) {

// Version this js was shipped with
var SALESFORCE_MOBILE_SDK_VERSION = "2.1.0.custom";

/*
 * JavaScript library to wrap REST API on Visualforce. Leverages Ajax Proxy
 * (see http://bit.ly/sforce_ajax_proxy for details). Based on forcetk.js,
 * but customized for consumption from within the Mobile SDK.
 *
 * Note that you must add the REST endpoint hostname for your instance (i.e.
 * https://na1.salesforce.com/ or similar) as a remote site - in the admin
 * console, go to Your Name | Setup | Security Controls | Remote Site Settings
 */

var forcetk = this.forcetk;

if (forcetk === undefined) {
    forcetk = this.forcetk = {};
}

if (forcetk.Client === undefined) {

    /**
     * The Client provides a convenient wrapper for the Force.com REST API,
     * allowing JavaScript in Visualforce pages to use the API via the Ajax
     * Proxy.
     * @param [clientId=null] 'Consumer Key' in the Remote Access app settings
     * @param [loginUrl='https://login.salesforce.com/'] Login endpoint
     * @param [proxyUrl=null] Proxy URL. Omit if running on Visualforce or
     *                  Cordova etc
     * @constructor
     */
    forcetk.Client = function (clientId, loginUrl, proxyUrl) {
        forcetk.Client(clientId, loginUrl, proxyUrl, null);
    }

    /**
     * The Client provides a convenient wrapper for the Force.com REST API,
     * allowing JavaScript in Visualforce pages to use the API via the Ajax
     * Proxy.
     * @param [clientId=null] 'Consumer Key' in the Remote Access app settings
     * @param [loginUrl='https://login.salesforce.com/'] Login endpoint
     * @param [proxyUrl=null] Proxy URL. Omit if running on Visualforce or
     *                  Cordova etc
     * @param authCallback Callback method to perform authentication when 401 is received.
     * @constructor
     */
    forcetk.Client = function (clientId, loginUrl, proxyUrl, authCallback) {
        this.clientId = clientId;
        this.loginUrl = loginUrl || 'https://login.salesforce.com/';
        if (typeof proxyUrl === 'undefined' || proxyUrl === null) {
            if (location.protocol === 'file:' || location.protocol === 'chrome-extension:') {
                this.proxyUrl = null;
            } else {
                this.proxyUrl = location.protocol + "//" + location.hostname + "/services/proxy";
            }
            this.authzHeader = "Authorization";
        } else {
            // On an external proxy service
            this.proxyUrl = proxyUrl;
            this.authzHeader = "X-Authorization";
        }
        this.refreshToken = null;
        this.sessionId = null;
        this.apiVersion = null;
        this.instanceUrl = null;
        this.userAgentString = this.computeWebAppSdkAgent(navigator.userAgent);
        this.authCallback = authCallback;
    };

    /**
    * Set a User-Agent to use in the client.
    * @param uaString A User-Agent string to use for all requests.
    */
    forcetk.Client.prototype.setUserAgentString = function (uaString) {
        this.userAgentString = uaString;
    };

    /**
    * Get User-Agent used by this client.
    */
    forcetk.Client.prototype.getUserAgentString = function () {
        return this.userAgentString;
    };


    /**
    * Compute SalesforceMobileSDK for web app
    */
    forcetk.Client.prototype.computeWebAppSdkAgent = function (navigatorUserAgent) {
        var sdkVersion = SALESFORCE_MOBILE_SDK_VERSION;
        var model = "Unknown"
        var platform = "Unknown";
        var platformVersion = "Unknown";
        var appName = window.location.pathname.split("/").pop();
        var appVersion = "1.0";

        var getIPadVersion = function() {
            var match = /CPU OS ([0-9_]*) like Mac OS X/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1].replace(/_/g, ".") : "Unknown");
        };

        var getIPhoneVersion = function() {
            var match = /CPU iPhone OS ([0-9_]*) like Mac OS X/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1].replace(/_/g, ".") : "Unknown");
        };

        var getIOSModel = function() {
            var match = /(iPad|iPhone|iPod)/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1] : "Unknown");
        };

        var getAndroidVersion = function() {
            var match = /Android ([0-9\.]*)/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1] : "Unknown");
        };

        var getAndroidModel = function() {
            var match = /Android[^\)]*; ([^;\)]*)/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1].replace(/[\/ ]/g, "_") : "Unknown");
        };

        var getWindowsPhoneVersion = function() {
            var match = /Windows Phone OS ([0-9\.]*)/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1] : "Unknown");
        };

        var getWindowsPhoneModel = function() {
            var match = /Windows Phone OS [^\)]*; ([^;\)]*)/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1].replace(/[\/ ]/g, "_") : "Unknown");
        };

        var getMacOSVersion = function() {
            var match = /Mac OS X ([0-9_]*)/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1].replace(/_/g, ".") : "Unknown");
        };

        var getWindowsVersion = function() {
            var match = /Windows NT ([0-9\.]*)/.exec(navigatorUserAgent);
            return (match !== null && match.length === 2 ? match[1] : "Unknown");
        };

        var match = /(iPhone|iPad|iPod|Android|Windows Phone|Macintosh|Windows)/.exec(navigatorUserAgent);
        if (match != null && match.length === 2) {
            switch(match[1]) {
            case "iPad":
                platform = "iPhone OS";
                platformVersion = getIPadVersion();
                model = "iPad";
                break;

            case "iPhone":
            case "iPod":
                platform = "iPhone OS";
                platformVersion = getIPhoneVersion();
                model = match[1];
                break;

            case "Android":
                platform = "android mobile";
                platformVersion = getAndroidVersion();
                model = getAndroidModel();
                break;

            case "Windows Phone":
                platform = "Windows Phone";
                platformVersion = getWindowsPhoneVersion();
                model = getWindowsPhoneModel();
                break;

            case "Macintosh":
                platform = "Mac OS";
                platformVersion = getMacOSVersion();
                break;

            case "Windows":
                platform = "Windows";
                platformVersion = getWindowsVersion();
                break;
            }
        }

        return "SalesforceMobileSDK/" + sdkVersion + " " + platform + "/" + platformVersion + " (" + model + ") " + appName + "/" + appVersion + " Web " + navigatorUserAgent;
    };

    /**
     * Set a refresh token in the client.
     * @param refreshToken an OAuth refresh token
     */
    forcetk.Client.prototype.setRefreshToken = function (refreshToken) {
        this.refreshToken = refreshToken;
    };

    /**
     * Refresh the access token.
     */
    forcetk.Client.prototype.refreshAccessToken = function () {
        var that = this;
        if (this.authCallback == null && this.refreshToken) {
            var url = this.loginUrl + '/services/oauth2/token';
            return $j.ajax({
                type: 'POST',
                url: (this.proxyUrl !== null) ? this.proxyUrl: url,
                cache: false,
                processData: false,
                data: 'grant_type=refresh_token&client_id=' + this.clientId + '&refresh_token=' + this.refreshToken,
                dataType: "json",
                beforeSend: function (xhr) {
                    if (that.proxyUrl !== null) {
                        xhr.setRequestHeader('SalesforceProxy-Endpoint', url);
                    }
                }
            }).then(function (response) {
                that.setSessionToken(response.access_token, null, response.instance_url);
                return response;
            });
        } else {
            return this.authCallback(that);
        }
    };

    /**
     * Set a session token and the associated metadata in the client.
     * @param sessionId a salesforce.com session ID. In a Visualforce page,
     *                   use '{!$Api.sessionId}' to obtain a session ID.
     * @param [apiVersion="v28.0"] Force.com API version
     * @param [instanceUrl] Omit this if running on Visualforce; otherwise
     *                   use the value from the OAuth token.
     */
    forcetk.Client.prototype.setSessionToken = function (sessionId, apiVersion, instanceUrl) {
        this.sessionId = sessionId;
        this.apiVersion = (typeof apiVersion === 'undefined' || apiVersion === null)
        ? 'v28.0': apiVersion;
        if (typeof instanceUrl === 'undefined' || instanceUrl === null) {
            // location.hostname can be of the form 'abc.na1.visual.force.com',
            // 'na1.salesforce.com' or 'abc.my.salesforce.com' (custom domains).
            // Split on '.', and take the [1] or [0] element as appropriate
            var elements = location.hostname.split(".");
            var instance = null;
            if (elements.length === 4 && elements[1] === 'my') {
                instance = elements[0] + '.' + elements[1];
            } else if (elements.length === 3) {
                instance = elements[0];
            } else {
                instance = elements[1];
            }
            this.instanceUrl = "https://" + instance + ".salesforce.com";
        } else {
            this.instanceUrl = instanceUrl;
        }
    };

    // Internal method to generate the key/value pairs of all the required headers for xhr.
    var getRequestHeaders = function (client) {
        var headers = {};

        headers[client.authzHeader] = "Bearer " + client.sessionId;
        headers['Cache-Control'] = 'no-store';
        // See http://www.salesforce.com/us/developer/docs/chatterapi/Content/intro_requesting_bearer_token_url.htm#kanchor36
        headers["X-Connect-Bearer-Urls"] = true;
        if (client.userAgentString !== null && location.protocol !== 'chrome-extension:') {
            headers['User-Agent'] = client.userAgentString;
            headers['X-User-Agent'] = client.userAgentString;
        }
        return headers;
    };

    var getForceInstanceUrl = function (instanceUrl) {
        var forceInstanceMap = {
            'https://ap.salesforce.com': 'https://c.ap0.visual.force.com',
            'https://ap1.salesforce.com': 'https://c.ap1.visual.force.com'
        };
        return forceInstanceMap[instanceUrl] || instanceUrl;
    }

    /*
     * Low level utility function to call the Salesforce endpoint.
     * @param url resource path relative to /services/data or full request url
     * @param [options] ajax options
     * @param rety true if we've already tried refresh token flow once
     */
    forcetk.Client.prototype.ajax = function (url, options, retry) {
        var that = this;
        if (typeof url === "object") {
            retry = options;
            options = url;
            url = options.url || "";
        }
        options = $j.extend({}, options) || {};
        delete options.url;
        if (url.indexOf('/') === 0) {
            if (url.indexOf('/apex/') === 0) {
                url = getForceInstanceUrl(this.instanceUrl) + url;
            } else if (url.indexOf('/services/apexrest') === 0) {
                url = this.instanceUrl + url;
            } else {
                url = this.instanceUrl + '/services/data' + url;
                options.dataType = "json";
                options.contentType = options.type === "DELETE" || options.type === "GET" ? null : 'application/json';
            }
        }
        // overwrap type
        if (options.type === "PATCH") {
            var separator = "?";
            if (url.indexOf("?") >= 0) {
                separator = "&";
            }
            url += separator + "_HttpMethod=" + options.type;
            options.type = "POST";
        }
        return $j.ajax($j.extend(options, {
            url: (that.proxyUrl !== null) ? that.proxyUrl: url,
            cache: false,
            processData: false,
            headers: $j.extend(options.headers || {}, getRequestHeaders(that)),
            success: undefined,
            error: undefined,
            complete: undefined,
            beforeSend: function (xhr) {
                if (that.proxyUrl !== null) {
                    xhr.setRequestHeader('SalesforceProxy-Endpoint', url);
                }
            }
        })).then(
            function (response) {
                return response;
            },
            function (jqXHR, textStatus, errorThrown) {
                if (that.refreshToken && !retry && jqXHR.status === 401) {
                    return that.refreshAccessToken()
                    .then(function () {
                        return that.ajax(url, options, true);
                    })
                }
                return jqXHR;
            }
        ).done(options.success)
        .fail(options.error)
        .always(options.complete);
    };

    /*
     * Low level utility function to get the Visualforce page.
     * @param page Visualforce page name
     * @param [options] ajax options
     */
    forcetk.Client.prototype.page = function (page, options, retry) {
        var path = '/apex' + page;
        return this.ajax(path, options);
    };

    /**
     * Utility function to query the Chatter API and download a file
     * Note, raw XMLHttpRequest because JQuery mangles the arraybuffer
     * This should work on any browser that supports XMLHttpRequest 2 because arraybuffer is required.
     * For mobile, that means iOS >= 5 and Android >= Honeycomb
     * @author Tom Gersic
     * @param path resource path relative to /services/data
     * @param mimetype of the file
     * @param rety true if we've already tried refresh token flow once
     **/
    forcetk.Client.prototype.getChatterFile = function (path, mimeType, retry) {
        var that = this;
        var url = this.instanceUrl + '/services/data' + path;
        var request = new XMLHttpRequest();
        request.open("GET",  (this.proxyUrl !== null) ? this.proxyUrl: url, true);
        request.responseType = "arraybuffer";
        request.setRequestHeader(that.authzHeader, "Bearer " + that.sessionId);
        if (that.userAgentString !== null && location.protocol !== 'chrome-extension:') {
            request.setRequestHeader('User-Agent', that.userAgentString);
            request.setRequestHeader('X-User-Agent', that.userAgentString);
        }
        if (this.proxyUrl !== null) {
            request.setRequestHeader('SalesforceProxy-Endpoint', url);
        }
        var d = new $j.Deferred;
        request.onreadystatechange = function() {
            // continue if the process is completed
            if (request.readyState === 4) {
                // continue only if HTTP status is "OK"
                if (request.status === 200) {
                    d.resolve(request.response);
                //refresh token in 401
                } else if (request.status === 401 && !retry) {
                    that.refreshAccessToken()
                    .then(function() {
                        return that.getChatterFile(path, mimeType, true)
                        .done(function (response) {
                            d.resolve(response);
                        }).fail(function (request, status, response) {
                            d.reject(request, status, response);
                        });
                    });
                } else {
                    d.reject(request, request.statusText, request.response);
                }
            }
        }
        request.send();
        return d.promise();
    };

    /*
     * Low level utility function to call the Salesforce endpoint specific for Apex REST API.
     * @param path resource path relative to /services/apexrest
     * @param [options] ajax options
     */
    forcetk.Client.prototype.apexrest = function (path, options) {
        var that = this;
        var path = '/services/apexrest' + path;
        return this.ajax(path, options);
    };

    /*
     * Lists summary information about each Salesforce.com version currently
     * available, including the version, label, and a link to each version's
     * root.
     * @param [options] ajax options
     */
    forcetk.Client.prototype.versions = function (options) {
        var path = '/';
        return this.ajax(path, options);
    };

    /*
     * Lists available resources for the client's API version, including
     * resource name and URI.
     * @param [options] ajax options
     */
    forcetk.Client.prototype.resources = function (options) {
        var path = '/' + this.apiVersion + '/';
        return this.ajax(path, options);
    };

    /*
     * Lists the available objects and their metadata for your organization's
     * data.
     * @param [options] ajax options
     */
    forcetk.Client.prototype.describeGlobal = function (options) {
        var path = '/' + this.apiVersion + '/sobjects/';
        return this.ajax(path, options);
    };

    /*
     * Describes the individual metadata for the specified object.
     * @param objtype object type; e.g. "Account"
     * @param [options] ajax options
     */
    forcetk.Client.prototype.metadata = function (objtype, options) {
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/';
        return this.ajax(path, options);
    };

    /*
     * Completely describes the individual metadata at all levels for the
     * specified object.
     * @param objtype object type; e.g. "Account"
     * @param [options] ajax options
     */
    forcetk.Client.prototype.describe = function (objtype, options) {
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/describe/';
        return this.ajax(path, options);
    };

    /*
     * Fetches the layout configuration for a particular sobject type and record type id.
     * @param objtype object type; e.g. "Account"
     * @param (Optional) recordTypeId Id of the layout's associated record type
     * @param [options] ajax options
     */
    forcetk.Client.prototype.describeLayout = function (objtype, recordTypeId, options) {
        recordTypeId = recordTypeId ? recordTypeId : '';
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/describe/layouts/' + recordTypeId;
        return this.ajax(path, options);
    };

    /*
     * Creates a new record of the given type.
     * @param objtype object type; e.g. "Account"
     * @param fields an object containing initial field names and values for
     *               the record, e.g. {:Name "salesforce.com", :TickerSymbol
     *               "CRM"}
     * @param [options] ajax options
     */
    forcetk.Client.prototype.create = function (objtype, fields, options) {
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/';
        return this.ajax(path,
            $j.extend(options || {}, {
                type: "POST",
                data: JSON.stringify(fields)
            })
        );
    };

    /*
     * Retrieves field values for a record of the given type.
     * @param objtype object type; e.g. "Account"
     * @param id the record's object ID
     * @param [fields=null] optional comma-separated list of fields for which
     *               to return values; e.g. Name,Industry,TickerSymbol
     * @param [options] ajax options
     */
    forcetk.Client.prototype.retrieve = function (objtype, id, fieldlist, options) {
        if (arguments.length === 2) {
            fieldlist = null;
        }
        var fields = fieldlist ? '?fields=' + fieldlist : '';
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/' + id + fields;
        return this.ajax(path, options);
    };

    /*
     * Upsert - creates or updates record of the given type, based on the
     * given external Id.
     * @param objtype object type; e.g. "Account"
     * @param externalIdField external ID field name; e.g. "accountMaster__c"
     * @param externalId the record's external ID value
     * @param fields an object containing field names and values for
     *               the record, e.g. {:Name "salesforce.com", :TickerSymbol
     *               "CRM"}
     * @param [options] ajax options
     */
    forcetk.Client.prototype.upsert = function (objtype, externalIdField, externalId, fields, options) {
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/' +
            externalIdField + '/' + externalId;
        return this.ajax(path,
            $j.extend(options || {}, {
                type: "PATCH",
                data: JSON.stringify(fields)
            })
        );
    };

    /*
     * Updates field values on a record of the given type.
     * @param objtype object type; e.g. "Account"
     * @param id the record's object ID
     * @param fields an object containing initial field names and values for
     *               the record, e.g. {:Name "salesforce.com", :TickerSymbol
     *               "CRM"}
     * @param [options] ajax options
     */
    forcetk.Client.prototype.update = function (objtype, id, fields, options) {
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/' + id;
        return this.ajax(path,
            $j.extend(options || {}, {
                type: "PATCH",
                data: JSON.stringify(fields)
            })
        );
    };

    /*
     * Deletes a record of the given type. Unfortunately, 'delete' is a
     * reserved word in JavaScript.
     * @param objtype object type; e.g. "Account"
     * @param id the record's object ID
     * @param [options] ajax options
     */
    forcetk.Client.prototype.del = function (objtype, id, options) {
        var path = '/' + this.apiVersion + '/sobjects/' + objtype + '/' + id;
        return this.ajax(path,
            $j.extend(options || {}, {
                type: "DELETE"
            })
        );
    };

    /*
     * Executes the specified SOQL query.
     * @param soql a string containing the query to execute - e.g. "SELECT Id,
     *             Name from Account ORDER BY Name LIMIT 20"
     * @param [options] ajax options
     */
    forcetk.Client.prototype.query = function (soql, options) {
        var path = '/' + this.apiVersion + '/query?q=' + encodeURI(soql);
        return this.ajax(path, options);
    };

    /*
     * Queries the next set of records based on pagination.
     * <p>This should be used if performing a query that retrieves more than can be returned
     * in accordance with http://www.salesforce.com/us/developer/docs/api_rest/Content/dome_query.htm</p>
     * <p>Ex: forcetkClient.queryMore( successResponse.nextRecordsUrl, successHandler, failureHandler )</p>
     *
     * @param url - the url retrieved from nextRecordsUrl or prevRecordsUrl
     * @param [options] ajax options
     */
    forcetk.Client.prototype.queryMore = function (url, options){
        return this.ajax(url, options);
    };

    /*
     * Executes the specified SOSL search.
     * @param sosl a string containing the search to execute - e.g. "FIND
     *             {needle}"
     * @param [options] ajax options
     */
    forcetk.Client.prototype.search = function (sosl, options) {
        var path = '/' + this.apiVersion + '/search?q=' + encodeURI(sosl);
        return this.ajax(path, options);
    };

    /*
     * Returns a page from the list of files owned by the specified user
     * @param userId a user id or 'me' - when null uses current user
     * @param page page number - when null fetches first page
     * @param [options] ajax options
     */
    forcetk.Client.prototype.ownedFilesList = function (userId, page, options) {
        var path = '/' + this.apiVersion + '/chatter/users/' + (userId == null ? 'me' : userId) +
            '/files' + (page != null ? '?page=' + page : '');
        return this.ajax(path, options);
    };

    /*
     * Returns a page from the list of files from groups that the specified user is a member of
     * @param userId a user id or 'me' - when null uses current user
     * @param page page number - when null fetches first page
     * @param [options] ajax options
     */
    forcetk.Client.prototype.filesInUsersGroups = function (userId, page, options) {
        var path = '/' + this.apiVersion + '/chatter/users/' + (userId == null ? 'me' : userId) +
            '/files/filter/groups' + (page != null ? '?page=' + page : '')
        return this.ajax(path, options);
    };

    /*
     * Returns a page from the list of files shared with the specified user
     * @param userId a user id or 'me' - when null uses current user
     * @param page page number - when null fetches first page
     * @param [options] ajax options
     */
    forcetk.Client.prototype.filesSharedWithUser = function (userId, page, options) {
        var path = '/' + this.apiVersion + '/chatter/users/' + (userId == null ? 'me' : userId) +
            '/files/filter/sharedwithme' + (page != null ? '?page=' + page : '')
        return this.ajax(path, options);
    };

    /*
     * Returns file details
     * @param fileId file's Id
     * @param version - when null fetches details of most recent version
     * @param [options] ajax options
     */
    forcetk.Client.prototype.fileDetails = function (fileId, version, options) {
        var path = '/' + this.apiVersion + '/chatter/files/' + fileId + (version != null ? '?versionNumber=' + version : '');
        return this.ajax(path, options);
    };

    /*
     * Returns file details for multiple files
     * @param fileIds file ids
     * @param [options] ajax options
     */
    forcetk.Client.prototype.batchFileDetails = function (fileIds, options) {
        var path = '/' + this.apiVersion + '/chatter/files/batch/' + fileIds.join(',');
        return this.ajax(path, options);
    };

    /*
     * Returns file rendition
     * @param fileId file's Id
     * @param version - when null fetches details of most recent version
     * @param rentidionType - FLASH, PDF, THUMB120BY90, THUMB240BY180, THUMB720BY480
     * @param page page number - when null fetches first page
     */
    forcetk.Client.prototype.fileRendition = function (fileId, version, renditionType, page) {
        var mimeType = renditionType == "FLASH" ? "application/x-shockwave-flash" : (renditionType == "PDF" ? "application/pdf" : "image/jpeg");
        var path = this.fileRenditionPath(fileId, version, renditionType, page);
        return this.getChatterFile(path, mimeType);
    };

    /*
     * Returns file rendition path (relative to service/data) - from html (e.g. img tag), use the bearer token url instead
     * @param fileId file's Id
     * @param version - when null fetches details of most recent version
     * @param rentidionType - FLASH, PDF, THUMB120BY90, THUMB240BY180, THUMB720BY480
     * @param page page number - when null fetches first page
     */
    forcetk.Client.prototype.fileRenditionPath = function (fileId, version, renditionType, page) {
        return '/' + this.apiVersion + '/chatter/files/' + fileId +
            '/rendition?type=' + renditionType +
            (version != null ? '&versionNumber=' + version : '') + (page != null ? '&page=' + page : '');
    };

    /*
     * Returns file content
     * @param fileId file's Id
     * @param version - when null fetches details of most recent version
     */
    forcetk.Client.prototype.fileContents = function (fileId, version) {
        var mimeType = null; // we don't know
        var path = this.fileContentsPath(fileId, version);
        return this.getChatterFile(path, mimeType);
    };

    /*
     * Returns file content path (relative to service/data) - from html (e.g. img tag), use the bearer token url instead
     * @param fileId file's Id
     * @param version - when null fetches details of most recent version
     */
    forcetk.Client.prototype.fileContentsPath = function (fileId, version) {
        return '/' + this.apiVersion + '/chatter/files/' + fileId +
            '/content' + (version != null ? '?versionNumber=' + version : '');
    };

    /**
     * Returns a page from the list of entities that this file is shared to
     *
     * @param fileId file's Id
     * @param page page number - when null fetches first page
     * @param [options] ajax options
     */
    forcetk.Client.prototype.fileShares = function (fileId, page, options) {
        var path = '/' + this.apiVersion + '/chatter/files/' + fileId + '/file-shares' + (page != null ? '?page=' + page : '');
        return this.ajax(path, options);
    };

    /**
     * Adds a file share for the specified fileId to the specified entityId
     *
     * @param fileId file's Id
     * @param entityId Id of the entity to share the file to (e.g. a user or a group)
     * @param shareType the type of share (V - View, C - Collaboration)
     * @param [options] ajax options
     */
    forcetk.Client.prototype.addFileShare = function (fileId, entityId, shareType, options) {
        var record = {ContentDocumentId:fileId, LinkedEntityId:entityId, ShareType:shareType};
        return this.create("ContentDocumentLink", record, options);
    };

    /**
     * Deletes the specified file share.
     * @param shareId Id of the file share record (aka ContentDocumentLink)
     * @param [options] ajax options
     */
    forcetk.Client.prototype.deleteFileShare = function (sharedId, options) {
        return this.del("ContentDocumentLink", sharedId, options);
    };
}})
.call(this, jQuery);
