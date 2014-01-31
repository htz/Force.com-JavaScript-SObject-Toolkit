;(function ($, OAuth2) {
	"use strict";

	var LOCAL_STRAGE_KEY = "session.info";

	// OAuth2Salesforce object
	var OAuth2Salesforce = function (options) {
		var self = this;
		self.login_url = options.login_url;
		self.token_url = options.token_url;
		self.client_id = options.client_id;
		self.redirect_uri = options.redirect_uri;
		self.scopes = options.scopes;
		self.display = options.display || "touch"; // page | popup | touch | mobile

		self.info = {
			loginUrl: self.login_url,
			clientId: self.client_id,
			accessToken: options.accessToken,
			refreshToken: options.refreshToken,
		};
		if (localStorage[LOCAL_STRAGE_KEY]) {
			self.info = $.extend(self.info, JSON.parse(localStorage[LOCAL_STRAGE_KEY]));
		}
		self.oauth = new OAuth2({
			authorize_url: self.login_url + "/services/oauth2/authorize?display=" + self.display,
			token_url: self.login_url + '/services/oauth2/token',
			client_id: self.client_id,
			redirect_uri: self.redirect_uri,
			response_type: "token",
			access_token: self.info.accessToken,
			refresh_token: self.info.refreshToken,
			scopes: self.scopes,
		});
	};

	// get auth credentials
	OAuth2Salesforce.prototype.getAuthCredentials = function () {
		var self = this;
		if (self.info.refreshToken) {
			return self.refreshToken();
		} else {
			return self.authorize();
		}
	};

	// authorize token
	OAuth2Salesforce.prototype.authorize = function () {
		var self = this;
		return self.oauth.authorize()
		.then(function (res) {
			self.info = $.extend(self.info, {
				accessToken: res.access_token,
				instanceUrl: res.instance_url,
				refreshToken: res.refresh_token,
				id: res.id,
				scopes: res.scope.split(" "),
			});
			localStorage[LOCAL_STRAGE_KEY] = JSON.stringify(self.info);
			return self.info;
		});
	};

	// refresh token
	OAuth2Salesforce.prototype.refreshToken = function () {
		var self = this;
		return self.oauth.refreshToken()
		.then(function (res) {
			self.info = $.extend(self.info, {
				accessToken: res.access_token,
				instanceUrl: res.instance_url,
				refreshToken: res.refresh_token,
				id: res.id,
				scopes: res.scope.split(" "),
			});
			localStorage[LOCAL_STRAGE_KEY] = JSON.stringify(self.info);
			return self.info;
		});
	};

	OAuth2Salesforce.prototype.setSessionToken = function (sessionId, refreshToken) {
		var self = this;
		self.info.accessToken = sessionId;
		self.oauth.setAccessToken(sessionId);
		self.info.refreshToken = refreshToken;
		self.oauth.setRefreshToken(refreshToken);
	};

	OAuth2Salesforce.prototype.logout = function () {
		var self = this;
		var url = self.info.instanceUrl + "/services/oauth2/revoke";
		localStorage.removeItem(LOCAL_STRAGE_KEY);
		return $.ajax({
			type: "POST",
			url: url,
			contentType: "application/x-www-form-urlencoded",
			cache: false,
			processData: false,
			data: "token=" + self.info.accessToken
		}).always(function () {
			self.setSessionToken(null, null);
		});
	};

	this.OAuth2Salesforce = OAuth2Salesforce;
}).call(this, jQuery, OAuth2);
