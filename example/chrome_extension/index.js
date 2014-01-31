(function ($) {
	var API_VERSION = "v29.0";
	var oauthConfig = {
		login_url: "https://login.salesforce.com",
		client_id: "3MVG99OxTyEMCQ3i7ijPpGb7_dhJkVENQxvlbQqecx0D0u4y4JCwYU7diCP0mxMoy35jbpORuQV6p4umx.GsF",
		redirect_uri: "https://login.salesforce.com/services/oauth2/success",
		scopes: ["web", "api", "refresh_token"]
	};

	var init = function () {
		var oauth = new OAuth2Salesforce(oauthConfig);
		return oauth.getAuthCredentials()
		.then(function (cre) {
			var client = new forcetk.Client(cre.clientId, cre.loginUrl);
			client.setSessionToken(cre.accessToken, API_VERSION, cre.instanceUrl);
			return forcetk.SObject.initialize(client);
		});
	};

	var main = function () {
		forcetk.SObject.Account.query({
			fields: [
				"Name",
				"LastModifiedBy.Name",
				"LastModifiedBy.CreatedDate",
				{
					CreatedBy: ["Name", "CreatedDate"]
				},
				new forcetk.SOQL({
					type: "Contacts",
					// fields: ["Name"],
					where: new forcetk.SOQL.Or([
						["Account.CreatedDate", "<", new forcetk.SOQL.Date("TODAY")],
						["Name", "!=", "test"]
					]),
					limit: 10
				})
			],
			where: new forcetk.SOQL.And([
				["LastModifiedDate", "<", new forcetk.SOQL.Date("TODAY")]
			]),
			orderBy: ["Name"],
			limit: 10,
			offset: 2
		})
		.done(function (records) {
			var $ul = $("#accounts");
			records.forEach(function (account) {
				var $li = $("<li>").text(account.Name).appendTo($ul);
				if (!account.Contacts) return;
				var $cul = $("<ul>").appendTo($li);
				account.Contacts.forEach(function (contact) {
					$("<li>").text(contact.Name).appendTo($cul);
				});
			});
		}).fail(function (err) {
			var msg = err.responseJSON[0].message;
			alert("SOQL query error!" + msg);
		});
	};

	$(function() {
		init().done(main);
	});
})(jQuery);
