# Force.com-JavaScript-sObject-Toolkit

## 概要

Force.com-JavaScript-SObject-ToolkitはJavaScriptからForce.comのオブジェクト (SObject) を手軽に扱うことが出来るライブラリです。


## ※注意
本ライブラリは[SalesforceMobileSDK-Shared](https://github.com/htz/SalesforceMobileSDK-Shared)(v2.1.0) のforcetk.mobilesdk.jsをカスタムしたものを前提に、force.sobject.jsが作成されています。そのため、オリジナルのforcetk.mobilesdk.jsは利用できません。

## forcetk.mobilesdk.jsのカスタム部分
* 非同期メソッド系は全てjQuery.Deferredを利用した形に全て変更 (全てのsuccess, error引数が取り払われています)
* 非同期/同期通信をasyncAjaxで設定する形になっていたものを、jQuery#ajaxと同様にasyncプロパティで呼び出し毎に設定できるように変更
* Visualforce及びChrome Extention対応
* 全体的に自分好みに整形

## 特徴
* Axpe上でsObjectを扱う位簡単にCRUD操作が可能
* 生のSOQL/SOSLクエリを記述する必要がない
* 各SObjectが`forcetk.SObject.XXX`というオブジェクトのインスタンスとして作成される (Accountなら`forcetk.SObject.Account`, Foo__cなら`forcetk.SObject.Foo__c`という具合)
* クエリの結果が`forcetk.SObject.*`の配列として返される
* DateやDatetime, Boolean等はそのままJavaScriptのDateやBooleanで扱える (相互の変換を意識する必要が無い)
* 初期化時にsObjectのメタデータ取得しているため、各sObjectに対応するModelの準備をする必要が無い
* 名前空間プレフィックスをシンプルに扱うことが可能 (現在テスト中)
* Visualforce, Phonegapアプリケーション, Chrome Extentionで利用可能

## 利用方法

###初期化

1. forcetk.Clientの初期化

	Visualforceの場合:

		var client = new forcetk.Client();
		client.setSessionToken("{!GETSESSIONID()}", API_VERSION);


	上記以外の場合:

		var client = new forcetk.Client(クライアントID [, ログインURL]);
		client.setSessionToken(OAuth Access aoken, APIバージョン, インスタンスURL);

2. forcetk.SObjectの初期化

		forcetk.SObject.initialize(client)
		.done(function () {
			// 初期化完了
		})
		.fail(function () {
			// 初期化失敗
		});

### レコードの作成
	var account = new SObject.Account({
		Name: 'テストアカウント'
	});
	account.Description = 'プロパティに直接追加も可能';
	account.save()
	.done(function () {
		// 保存成功
	});

### レコードの更新
	account.Name = '変更後の名前';
	account.save()
	.done(function () {
		// 更新成功
	});

### レコードの削除
	account.delete()
	.done(function () {
		// 更新成功
	});

### レコードのコピー
	var clone = account.clone();
	clone.save()
	.done(function () {
		// 保存成功
	});

### レコードのupsert
	account.upsert({
		externalId: '00xxxx',
		externalIdField: 'ExternalId__c'
	})
	.done(function () {
		// upsert成功
	});

### sObjectの情報取得
	forcetk.SObject.Account.describe()
	.done(function (desc) {
		// descにメタデータが入っている
	});

### sObjectの属性の情報取得
	var desc = forcetk.SObject.Account.describeField('Name');
	/* 同期で欲しい場合が多いので同期メソッドになっている */

### sObjectの全ての属性の情報取得
	forcetk.SObject.Account.describeFields()
	.done(function (descMap) {
		// descMapはフィールド名をキーにして取得出来る
	});
	/* 同期で欲しい場合が多いので同期メソッドになっている */

### sObjectの属性のラベル取得
	var label = forcetk.SObject.Account.getLabel('Name');
	/* 同期で欲しい場合が多いので同期メソッドになっている */

### sObjectの子リレーションの情報取得
	var label = forcetk.SObject.Account.describeChildRelation('Contacts');
	/* 同期で欲しい場合が多いので同期メソッドになっている */

### sObjectのメタデータ取得
	forcetk.SObject.Account.metadata()
	.done(function (meta) {
		// metaにメタデータが入っている
	});

### sObjectの最近使ったレコードを取得
	forcetk.SObject.Account.recentItems()
	.done(function (records) {
		// recordsに最近使ったレコード配列が入っている
	});

### SOQLクエリ
単純なSOQL

	forcetk.SObject.Account.query({
		fields: ['Name']
	})
	.done(function (accounts) {
		// accountsに取得したAccountの配列が入っている
	});
	/* `Select Name From Account`と等価 */

全てのフィールド

	forcetk.SObject.Account.query()
	.done(function (accounts) {
		// accountsに取得したAccountの配列が入っている
	});
	/* SOQLで*は指定出来ないが、`Select * From Account`と等価 */

親オブジェクトのクエリ

	forcetk.SObject.Account.query({
		fields: [
			'Name',
			'LastModifiedBy.Name',
			'LastModifiedBy.CreatedDate',
			'CreatedBy.Name'
		]
	})

	forcetk.SObject.Account.query({
		fields: [
			Name,
			{
				'LastModifiedBy': ['Name', 'CreatedDate'],
				'CreatedBy': []'Name']
			}
		]
	})

	/* 上記共に`Select Name, LastModifiedBy.Name, LastModifiedBy.CreatedDate, CreatedBy.Name From Account`と等価 */

子オブジェクトのクエリ

	forcetk.SObject.Account.query({
		fields: [
			'Name',
			new forcetk.SOQL({
				type: 'Contacts',
				fields: ['Name']
			})
		]
	})
	/* `Select Name, (Select Name From Contacts) From Account`と等価 */

条件指定

	forcetk.SObject.Account.query({
		fields: ['Name']
		where: new forcetk.SOQL.And([
			['Name', 'like' 'test%'] // 注1
		])
	})
	/* `Select Name From Account Where Name like 'test%'`と等価
	/* 注1は配列の要素数により変換されるSOQLが変わる
		['Name', '!=', 'test'] と3要素にすると `Name != 'test'`と等価
		['Name', 'test'] と2要素にすると `Name = 'test'`と等価
		['Name'] と1要素にすると `Name != null`と等価
	 */

複雑な条件指定 

	forcetk.SObject.Account.query({
		fields: ['Name']
		where: new forcetk.SOQL.Or([
			['NumberOfEmployees', '<', 10],
			new forcetk.SOQL.And([
				['Name', 'like', 'test%'],
				['NumberOfEmployees', '>', 100],
			])
		])
	})
	/* `Select Name From Account Where NumberOfEmployees < 10 Or (Name like 'test%' And NumberOfEmployees > 1000`と等価 */

Not

	where: new forcetk.SOQL.Not(
		new forcetk.SOQL.And([
			['Name', 'like' 'test%']
		])
	])
	// Not (Name like 'test%')と等価

In

	where: new forcetk.SOQL.In('Name', ['test1', 'test2'])
	// Name In ('test1', 'test2')と等価

NotIn

	where: new forcetk.SOQL.NotIn('Name', ['test1', 'test2'])
	// Name NotIn ('test1', 'test2')と等価

Date関連を条件に入れる

	/* JavaScriptのDateを使用 */
	where: new forcetk.SOQL.And([
		['CreatedDate', '<=', new Date()]
	])
	/* CreatedDate <= 2014-01-31T07:26:01.804Z と等価 */

	where: new forcetk.SOQL.And([
		['CreatedDate', '=', new forcetk.SOQL.Date.YESTERDAY()]
	])
	/* CreatedDate <= YESTERDAY と等価 */

	/* その他いろいろソースコード参照の事 :P */

Limit

	forcetk.SObject.Account.query({
		fields: ['Name']
		limit: 10
	})
	/* `Select Name From Account Limit 10`と等価 */

Order By

	forcetk.SObject.Account.query({
		fields: ['Name']
		orderBy: 'Name'
	})
	/* `Select Name From Account Order By Name`と等価 */

	forcetk.SObject.Account.query({
		fields: ['Name']
		orderBy: [
			'Name',
			'NumberOfEmployees'
		]
	})
	/* `Select Name From Account Order By Name, NumberOfEmployees`と等価 */

	forcetk.SObject.Account.query({
		fields: ['Name']
		orderBy: [
			Id,
			['Name', 'DESC'],
			['NumberOfEmployees', 'DESC', 'NULLS FIRST']
		]
	})
	/* `Select Name From Account Order By Id, Name DESC , NumberOfEmployees DESC NULLS FIRST`と等価 */

Offset

	forcetk.SObject.Account.query({
		fields: ['Name']
		Offset: 10
	})
	/* `Select Name From Account Offset 10`と等価 */

Group By

	forcetk.SObject.Account.query({
		fields: ['Name']
		groupBy: ['Name']
	})
	/* `Select Name From Account Group By Name`と等価 */

Having

	forcetk.SObject.Account.query({
		fields: ['Name']
		groupBy: ['Name']
		having: forcetk.SOQL.And([
			['Name', '!=', 'test']
		])
	})
	/* `Select Name From Account Group By Name Having != 'test'`と等価 */
	/* where句と利用方法は同じ */


### SOSL
後で書く :P

## サンプル
各サンプルはAccount及びAccountに紐づくContact情報を取得し表示するアプリケーションです。各サンプル共main関数内は同様の内容になっています。

また、下記サンプルでChrome ExtentionとPhonegapではOAuthを行うために、exampleに同梱の

* oauth2.js
* oauth2_salesforce.js

を利用しています。これは、Chrome Extention及びPhonegapでSalesforceの認可を得るためのライブラリです。

※ Phonegapは3.1で動作の確認をしておりInAppBrowserのプラグインが入っている事が必須になります。
※ Chrome Extentionの場合は個別に`manifest.json`も用意する必要があります

### Visualforce
sample.page:

	<apex:page showHeader="false" standardStylesheets="false" applyBodyTag="false">
	<script type="text/javascript" src="{!URLFOR($Resource.forcetk_sobject, 'jquery-2.1.0.min.js')}"></script>
	<script type="text/javascript" src="{!URLFOR($Resource.forcetk_sobject, 'forcetk.mobilesdk.custom.js')}"></script>
	<script type="text/javascript" src="{!URLFOR($Resource.forcetk_sobject, 'forcetk.sobject.js')}"></script>
	<script type="text/javascript">
		(function ($) {
			var API_VERSION = "v29.0";

			var init = function () {
				var client = new forcetk.Client();
				client.setSessionToken("{!GETSESSIONID()}", API_VERSION);
				return forcetk.SObject.initialize(client);
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
	</script>
	<body>
		<ul id="accounts"></ul>
	</body>
	</apex:page>

## Chrome Extention / Phonegap
index.html:

	<!DOCTYPE html>
	<html>
	<head>
		<meta http-equiv="Content-type" content="text/html; charset=utf-8">
		<script src="jquery-2.1.0.min.js"></script>
		<script src="purl.js"></script>
		<script src="oauth2.js"></script>
		<script src="oauth2_salesforce.js"></script>
		<script src="forcetk.mobilesdk.custom.js"></script>
		<script src="forcetk.sobject.js"></script>
		<script src="index.js"></script>
	</head>
	<body>
		<ul id="accounts"></ul>
	</body>
	</html>

index.js:

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
			// Visualforceのサンプルと同様
		};
		
		$(function() {
			init().done(main);
		});
	})(jQuery);


## 解説

### main
`main`では主な処理を行っています。

ここで発行されているクエリは以下のSOQLと等価です。

	SELECT
		Name,
		LastModifiedBy.Name, LastModifiedBy.CreatedDate,
		CreatedBy.Name, CreatedBy.CreatedDate,
		(
			SELECT
				IsDeleted, LastName, FirstName, Salutation, Name, OtherStreet, OtherCity, OtherState,
				OtherPostalCode, OtherCountry, OtherLatitude, OtherLongitude, MailingStreet, MailingCity,
				MailingState, MailingPostalCode, MailingCountry, MailingLatitude, MailingLongitude, Phone,
				Fax, MobilePhone, HomePhone, OtherPhone, AssistantPhone, Email, Title, Department, AssistantName,
				LeadSource, Birthdate, Description, CreatedDate, LastModifiedDate, SystemModstamp, LastActivityDate,
				LastCURequestDate, LastCUUpdateDate, LastViewedDate, LastReferencedDate, EmailBouncedReason,
				EmailBouncedDate, IsEmailBounced, Jigsaw
			FROM
				Contacts
			WHERE
				Account.CreatedDate < TODAY OR
				Name != 'test'
			LIMIT 10
		)
	FROM
		Account
	WHERE
		LastModifiedDate < TODAY
	ORDER BY Name
	LIMIT 10
	OFFSET 2

### init
`init`ではOAuth及びforcetk.Client, forcetk.SObjectの初期化を行っています。VisualforceではセッションIDをそのまま利用することが出来るためOAuthの呼び出しは不要です。また、初期化が完了後にjQuery.Deferredのresolveが発行されるようになっているため、`init().done(main);`とするだけで初期化後にmainの実行が開始されます。

## サンプルの利用方法

### Visualforce

まず、

* jquery-2.1.0.min.js
* forcetk.mobilesdk.custom.js
* forcetk.sobject.js

をzip圧縮し静的リソースに`forcetk_sobject`という名前でアップロードします。

次にサンプルのindex.pageをコピー&ペーストして完了です。

### Chrome Extention

Chromeで`chrome://extensions/`を開き`パッケージ化されていない拡張機能を読み込む...`を選択する。サンプルのchrome_extensionを選択しアプリケーションのインストールをする。起動方法は、`chrome://apps/`から`sobject.js`というアプリケーション選択する。

### Phonegap

プロジェクトを作成後、InAppBrowserプラグインを追加する(`cordova plugin add org.apache.cordova.inappbrowser`)。その後wwwディレクトリにサンプルのファイルを全て入れて実行する。
