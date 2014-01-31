;(function ($) {
	"use strict";

	// OAuth2 object
	var OAuth2 = function (options) {
		var self = this;
		self.info = {
			access_token: options.access_token,
			refresh_token: options.refresh_token,
		};
		self.authorize_url = options.authorize_url;
		self.token_url = options.token_url;
		self.client_id = options.client_id;
		self.client_secret = options.client_secret;
		self.redirect_uri = options.redirect_uri;
		self.response_type = options.response_type || "token";
		self.scopes = options.scopes || [];
	};

	OAuth2.prototype.hasToken = function () {
		var self = this;
		if (!self.info.access_token || self.info.access_token === "") return false;
		return true;
	};

	var _authorizeUrl = function () {
		var self = this;
		var url = $.url(self.authorize_url);
		var params = $.extend({
			"response_type": self.response_type,
			"client_id": self.client_id,
			"redirect_uri": self.redirect_uri,
			"scope": self.scopes.join(" ")
		}, url.param());

		return url.attr("protocol") + "://" +
			url.attr("host") + url.attr("path") +
			"?" + $.param(params);
	};

	var _parseParameters = function (url, separator) {
		var separator = separator || "?";
		var res = {};
		var url = $.url(url);

		if (separator === "?") {
			var nvps = url.attr("query").split("&");
		} else if (separator === "#") {
			var nvps = url.attr("fragment").split("&");
		} else {
			var nvps = {};
		}
		for (var nvp in nvps) {
			var parts = nvps[nvp].split("=");
			res[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
		}
		return res;
	};

	var _isSameUrl = function (url1, url2) {
		return url1.split(/[\?#]/)[0] === url2.split(/[\?#]/)[0];
	};

	// authorize
	OAuth2.prototype.authorize = function () {
		var self = this;
		if (location.protocol === "chrome-extension:") {
			return _authorizeChrome.call(self);
		} else {
			return _authorize.call(self);
		}
	};

	var _authorizeCallback = function (d, url) {
		var self = this;
		if (self.response_type === "token") {
			var res = _parseParameters(url, "#");
			if (res.access_token) {
				self.info = res;
				d.resolve(res);
				return;
			}
		} else if (self.response_type === "code" && self.token_url) {
			var res = _parseParameters(url, "?");
			if (res.code) {
				_accessToken.call(self, res.code, function(request, textStatus) {
					if (request.status === 200) {
						var res = JSON.parse(request.responseText);
						self.info = res;
						d.resolve(res);
					} else {
						d.reject();
					}
				});
				return;
			}
		}
		d.reject();
	};

	var _authorizeChrome = function () {
		var self = this;
		var d = new $.Deferred;
		var isDone = false;
		chrome.tabs.create(
			{url: _authorizeUrl.call(self)},
			function () {
				var updateListener = function (tabId, info, tab) {
					if (info.status === "loading" && _isSameUrl(tab.url, self.redirect_uri)) {
						isDone = true;
						chrome.tabs.onUpdated.removeListener(updateListener);
						chrome.tabs.remove(tabId);
						_authorizeCallback.call(self, d, tab.url);
					}
				};
				var removeListener = function (tabId, info) {
					chrome.tabs.onUpdated.removeListener(removeListener);
					if (!isDone) {
						d.reject();
					}
				};
				chrome.tabs.onUpdated.addListener(updateListener);
				chrome.tabs.onRemoved.addListener(removeListener);
			}
		);
		return d.promise();
	};

	var _authorize = function () {
		var self = this;
		var d = new $.Deferred;
		var isDone = false;
		var authWindow = window.open(_authorizeUrl.call(self), '_blank', 'location=no,toolbar=yes');
		$(authWindow).on("loadstart", function(e) {
			if (_isSameUrl(e.originalEvent.url, self.redirect_uri)) {
				isDone = true;
				authWindow.close();
				_authorizeCallback.call(self, d, e.originalEvent.url);
			}
		}).on("exit", function (e) {
			if (!isDone) {
				d.reject();
			}
		});
		return d.promise();
	};

	var _accessToken = function (code, callback) {
		var self = this;
		$.ajax({
			type: "POST",
			url: self.token_url,
			data: {
				state: "",
				code: code,
				client_id: self.client_id,
				client_secret: self.client_secret,
				redirect_uri: self.redirect_uri,
				grant_type: "authorization_code"
			},
			dataType: "json",
			timeout: 5000,
			complete: callback
		});
	};

	OAuth2.prototype.refreshToken = function () {
		var self = this;
		return $.ajax({
			type: "POST",
			url: self.token_url,
			data: {
				state: "",
				client_id: self.client_id,
				refresh_token: self.info.refresh_token,
				grant_type: "refresh_token"
			},
			dataType: "json",
			timeout: 5000
		}).then(
			function (res) {
				self.info = $.extend(self.info, res);
				return self.info;
			},
			function (jqXHR, textStatus, errorThrown) {
				if (jqXHR.status === 400) {
					return self.authorize();
				}
			}
		);
	};

	OAuth2.prototype.setAccessToken = function (access_token) {
		var self = this;
		self.info.access_token = access_token;
	};

	OAuth2.prototype.setRefreshToken = function (refresh_token) {
		var self = this;
		self.info.refresh_token = refresh_token;
	};

	this.OAuth2 = OAuth2;
}).call(this, jQuery);
