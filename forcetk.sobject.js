;(function ($, _) {
	"use strict";

	var ALL_PREFIX_NAME_REGEXP = /^([a-z0-9]+)__([a-z0-9_]+__[crs])$/i;
	var OBJECT_PREFIX_NAME_REGEXP = /^([a-z0-9]+)__([a-z0-9_]+__c)$/i;

	// util methods
	var _ = _ || {
		breaker: {},
		isUndefined: function (obj) {
			return obj === void 0;
		},
		isFunction: function (obj) {
			return toString.call(obj) == '[object Function]';
		},
		isObject: function (obj) {
			return obj === Object(obj);
		},
		isString: function(obj) {
			return toString.call(obj) == '[object String]';
		},
		isArray: function(obj) {
			return toString.call(obj) == '[object Array]';
		},
		isDate: function(obj) {
			return toString.call(obj) == '[object Date]';
		},
		isNumber: function(obj) {
			return toString.call(obj) == '[object Number]';
		},
		isBoolean: function (obj) {
			return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
		},
		isNull: function (obj) {
			return obj === null;
		},
		has: function(obj, key) {
			return hasOwnProperty.call(obj, key);
		},
		isEmpty: function (obj) {
			if (obj == null) return true;
			if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
			for (var key in obj) if (_.has(obj, key)) return false;
			return true;
		},
		keys: function (obj) {
			if (obj !== Object(obj)) throw new TypeError('Invalid object');
			var keys = [];
			for (var key in obj) if (_.has(obj, key)) keys.push(key);
			return keys;
		},
		each: function (obj, iterator, context) {
			if (obj == null) return;
			if (_.isArray(obj)) {
				for (var i = 0; i < obj.length; i++) {
					if (iterator.call(context, obj[i], i, obj) === _.breaker) return;
				}
			} else {
				var keys = _.keys(obj);
				for (var i = 0, length = keys.length; i < length; i++) {
					if (iterator.call(context, obj[keys[i]], keys[i], obj) === _.breaker) return;
				}
			}
		},
		map: function (obj, iterator, context) {
			var results = [];
			_.each(obj, function(value, index, list) {
				results.push(iterator.call(context, value, index, list));
			});
			return results;
		},
		reduce: function(obj, iterator, memo, context) {
			var initial = arguments.length > 2;
			if (obj == null) obj = [];
			_.each(obj, function(value, index, list) {
				if (!initial) {
					memo = value;
					initial = true;
				} else {
					memo = iterator.call(context, memo, value, index, list);
				}
			});
			if (!initial) throw new TypeError('Reduce of empty array with no initial value');
			return memo;
		},
		any: function (obj, iterator, context) {
			var result = false;
			if (obj == null) return result;
			_.each(obj, function(value, index, list) {
				if (result || (result = iterator.call(context, value, index, list))) return _.breaker;
			});
			return !!result;
		},
		find: function (obj, iterator, context) {
			var result;
			_.any(obj, function(value, index, list) {
				if (iterator.call(context, value, index, list)) {
					result = value;
					return true;
				}
			});
			return result;
		}
	};

	var Util = {
		date2soqlDate: function (date) {
			// yyyy-MM-dd
			return date.getFullYear() + "-" +
				("0" + date.getMonth()).slice(-2) + "-" +
				("0" + date.getDate()).slice(-2);
		},
		soqlDate2date: function (dateStr) {
			var vals = dateStr.match(/^(\d+)\-(\d+)\-(\d+)$/);
			return new Date(vals[1], vals[2] - 1, vals[3]);
		},
		date2soqlDatetime: function (date) {
			return date.toJSON();
		},
		soqlDate2datetime: function (datetimeStr) {
			var vals = datetimeStr.match(/^(\d+)\-(\d+)\-(\d+)T(\d+)\:(\d+)\:(\d+)\.(\d+)([+-])(\d{2})(\d{2})$/);
			var timeOffset = parseInt(vals[8] + vals[9]) * 60 + parseInt(vals[8] + vals[10]);
			var currentOffset = new Date().getTimezoneOffset();
			var t = new Date(vals[1], vals[2] - 1, vals[3], vals[4], vals[5], vals[6], vals[7]);
			return new Date(t.getTime() + (timeOffset - currentOffset) * 60 * 1000);
		},
		soqlEscape: function (str) {
			return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (c) {
				switch (c) {
				case "\0": return "\\0";
				case "\x08": return "\\b";
				case "\x09": return "\\t";
				case "\x1a": return "\\z";
				case "\n": return "\\n";
				case "\r": return "\\r";
				default: return "\\" + c;
				}
			});
		},
		soslEscape: function (str) {
			return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%?&|!{}\[\]()^~*\:"'+-]/g, function (c) {
				switch (c) {
				case "\0": return "\\0";
				case "\x08": return "\\b";
				case "\x09": return "\\t";
				case "\x1a": return "\\z";
				case "\n": return "\\n";
				case "\r": return "\\r";
				default: return "\\" + c;
				}
			});
		}
	};

	// SOQL object
	var SOQL = function (options) {
		this.type = options.type;
		this.prefix = options.prefix;
		this.fields = options.fields;
		this.where = options.where;
		this.groupBy = options.groupBy;
		this.having = options.having;
		this.orderBy = options.orderBy;
		this.limit = options.limit;
		this.offset = options.offset;
	};

	SOQL.prototype.clone = function () {
		return new SOQL(this);
	};

	SOQL.prototype.toString = function (type) {
		if (this.prefix) {
			var sobject = SObject.prefix[this.prefix][type || this.type];
			this._usePrefix = this.prefix;
		} else {
			if (this._usePrefix) {
				var sobject = SObject.prefix[this._usePrefix][type || this.type];
				this.prefix = this._usePrefix;
			}
			if (!sobject) {
				var sobject = SObject[type || this.type];
			}
		}
		return "SELECT " +
			this.toStringFields(sobject) +
			" FROM " + (this.prefix ? this.prefix + "__" + this.type : this.type) +
			this.toStringWhere(sobject) +
			this.toStringWith(sobject) +
			this.toStringGroupBy(sobject) +
			this.toStringOrderBy(sobject) +
			this.toStringHaving(sobject) +
			this.toStringLimit() +
			this.toStringOffset();
	};

	SOQL.prototype.toStringFields = function (sobject) {
		var self = this;
		var fields = self.fields;

		if (!self.fields) {
			fields = [];
			$.when(sobject.describe(false))
			.done(function (desc) {
				_.each(desc.fields, function (f) {
					if (f.name.toLowerCase() == "id" || f.relationshipName) return;
					fields.push(f.name);
				});
			});
		} else {
			if (_.isFunction(fields)) {
				fields = fields();
			}
			fields = _.reduce(fields, function (fields, field) {
				if (_.isFunction(field)) {
					field = field();
				}
				if (field instanceof SOQL) {
					var childType = sobject.describeChildRelation(field.type).childSObject;
					field._usePrefix = self._usePrefix;
					if (childType.match(OBJECT_PREFIX_NAME_REGEXP) && self._usePrefix === RegExp.$1) {
						field.prefix = self._usePrefix;
						fields.push("(" + field.toString(RegExp.$2) + ")");
					} else {
						fields.push("(" + field.toString(childType) + ")");
					}
				} else if (_.isObject(field)) {
					var objectField = function (sobject, base, f) {
						_.each(f, function (val, key) {
							var desc = sobject.describeField(key, true);
							if (base) key = base + "." + desc.relationshipName;
							else key = desc.relationshipName;
							if (self._usePrefix && desc.referenceTo[0].match(OBJECT_PREFIX_NAME_REGEXP)) {
								var nextSobject = SObject.prefix[RegExp.$1][RegExp.$2];
							}
							if (!nextSobject) {
								var nextSobject = SObject[desc.referenceTo[0]];								
							}
							_.each(val, function (f0) {
								if (_.isObject(f0)) {
									objectField(nextSobject, key, f0);
								} else if (f0.toLowerCase() !== "id") {
									fields.push(key + "." + _toStringField.call(self, nextSobject, f0));
								}
							});
						});
					};
					objectField(sobject, '', field);
				} else if (field.toLowerCase() !== "id") {
					fields.push(_toStringField.call(self, sobject, field));
				}
				return fields;
			}, []);
		}
		if (fields.length === 0) fields.push("id");
		return fields.join(", ");
	};

	var _toStringField = function (sobject, field) {
		var self = this;
		var tmp = field.toString().split(".");
		if (tmp.length === 1) {
			var desc = sobject.describeField(tmp[0]);
			return desc.name;
		} else {
			var relationField = function (sobject, fields) {
				if (fields.length === 1) {
					var desc = sobject.describeField(fields[0]);
					return desc.name;
				} else {
					var desc = sobject.describeField(fields[0], true);
					if (self._usePrefix && desc.referenceTo[0].match(OBJECT_PREFIX_NAME_REGEXP)) {
						var nextSobject = SObject.prefix[RegExp.$1][RegExp.$2];
					}
					if (!nextSobject) {
						var nextSobject = SObject[desc.referenceTo[0]];
					}
					return desc.relationshipName + "." + relationField(nextSobject, fields.slice(1));
				}
			};
			return relationField(sobject, tmp);
		}
	};

	SOQL.prototype.toStringWhere = function (sobject) {
		var where = this.where;
		if (_.isFunction(where)) {
			where = where();
		}
		if (!where) return "";
		where._usePrefix = this._usePrefix;
		return " WHERE " + where.toString(sobject);
	};

	SOQL.prototype.toStringWith = function (sobject) {
		var wiz = this.with;
		if (_.isFunction(wiz)) {
			wiz = wiz();
		}
		if (!wiz) return "";
		wiz._usePrefix = this._usePrefix;
		return " WHITH " + wiz.toString(sobject);
	};

	SOQL.prototype.toStringGroupBy = function (sobject) {
		var self = this;
		var groupBy = self.groupBy;
		if (_.isFunction(groupBy)) {
			groupBy = groupBy();
		}
		if (!groupBy) return "";
		if (!_.isArray(groupBy)) {
			groupBy = [groupBy];
		}
		if (groupBy.length > 0) {
			return " GROUP BY " + _.map(groupBy, function (o) {
				var f =  _.isFunction(o) ? o() : o;
				return _toStringField.call(self, sobject, f);
			}).join(", ");
		}
		return "";
	};

	SOQL.prototype.toStringHaving = function (sobject) {
		var having = this.having;
		if (_.isFunction(having)) {
			having = having();
		}
		if (!having) return "";
		return " HAVING " + having.toString(sobject);
	};

	SOQL.prototype.toStringOrderBy = function (sobject) {
		var self = this;
		var orderBy = self.orderBy;
		if (_.isFunction(orderBy)) {
			orderBy = orderBy();
		}
		if (!orderBy) return "";
		if (!_.isArray(orderBy)) {
			orderBy = [orderBy];
		}
		if (orderBy.length > 0) {
			return " ORDER BY " + _.map(orderBy, function (o) {
				var v = _.isFunction(o) ? o() : o;
				if (_.isArray(v)) {
					var f = _toStringField.call(self, sobject, v[0]);
					// ex. ["Name", "Desc", "NULLS FIRST"]
					if (v.length == 1) return f;
					if (v.length == 2) return f + " " + v[1];
					if (v.length == 3) return f + " " + v[1] + " " + v[2];
					throw new TypeError('invalid argument');
				} else {
					return _toStringField.call(self, sobject, v);
				}
			}).join(", ");
		}
		return "";
	};

	SOQL.prototype.toStringLimit = function () {
		var limit = this.limit;
		if (_.isFunction(limit)) {
			limit = limit();
		}
		if (_.isNumber(limit) && limit > 0) {
			return " LIMIT " + limit;
		}
		return "";
	};

	SOQL.prototype.toStringOffset = function () {
		var offset = this.offset;
		if (_.isFunction(offset)) {
			offset = offset();
		}
		if (_.isNumber(offset) && offset >= 0) {
			return " OFFSET " + offset;
		}
		return "";
	};

	SOQL.prototype.query = function(client, options) {
		var self = this;
		var soql = self.toString();
		console.log("SOQL: " + soql);
		return client.query(soql, options)
		.then(function (res) {
			return _toSObjects(res.records, self.prefix ? true : false);
		});
	};

	// SOQL.Where Object
	SOQL.Where = SOQL.Having = function () {};

	// SOQL.And Object
	SOQL.And = function (where, op) {
		this.op = op || "AND";
		this.where = where;
	};
	SOQL.And.prototype = new SOQL.Where();

	SOQL.And.prototype.toString = function (sobject) {
		var self = this;
		var where = self.where
		if (_.isFunction(where)) {
			where = where();
		}
		return _.map(where, function (w) {
			if (w instanceof SOQL.Where) {
				w._usePrefix = self._usePrefix;
				return "(" + w.toString(sobject) + ")";
			} else if (_.isArray(w)) {
				var f = _toStringField.call(self, sobject, w[0]);
				if (w.length === 1) return _joinExpression(f, "!=", null, sobject);
				if (w.length === 2) return _joinExpression(f, "=", w[1], sobject);
				if (w.length === 3) return _joinExpression(f, w[1], w[2], sobject);
				throw new TypeError('invalid argument');
			} else {
				var f = _toStringField.call(self, sobject, w.field);
				return _joinExpression(f, w.op || "=", w.value, sobject);
			}
		}).join(" " + self.op + " ");
	};

	// SOQL.Or Object
	SOQL.Or = function (where, op) {
		this.op =  op || "OR";
		this.where = where;
	};
	SOQL.Or.prototype = new SOQL.And();

	// SOQL.Not Object
	SOQL.Not = function (where) {
		this.where = where;
	};
	SOQL.Not.prototype = new SOQL.Where();

	SOQL.Not.prototype.toString = function (sobject) {
		var where = this.where;
		if (_.isFunction(where)) {
			where = where();
		}
		where._usePrefix = this._usePrefix;
		return "NOT (" + where.toString(sobject) + ")";
	};

	// SOQL.In Object
	SOQL.In = function (field, values, op) {
		this.field = field;
		this.op = op || "IN";
		this.values = values;
	};
	SOQL.In.prototype = new SOQL.Where();

	SOQL.In.prototype.toString = function (sobject) {
		var self = this;
		var values = self.values
		if (_.isFunction(values)) {
			values = values();
		}
		var f = _toStringField.call(self, sobject, self.field);
		return f + " " + self.op + " (" + (function () {
			if (values instanceof SOQL) {
				values._usePrefix = self._usePrefix;
				return values.toString(sobject);
			} else if (_.isArray(values)) {
				var desc = sobject.describeField(self.field);
				return _.map(values, function (v) {
					return _valueToString(v, desc);
				}).join(", ");
			}
		})() + ")";
	};

	// SOQL.NotIn Object
	SOQL.NotIn = function (field, values, op) {
		this.field = field;
		this.op = op || "NOT IN";
		this.values = values;
	};
	SOQL.NotIn.prototype = new SOQL.In();

	// SOQL.Include Object
	SOQL.Include = function (field, values, op) {
		this.field = field;
		this.op = op || "INCLUDE";
		this.values = values;
	};
	SOQL.Include.prototype = new SOQL.In();

	// SOQL.EXclude Object
	SOQL.EXclude = function (field, values, op) {
		this.field = field;
		this.op = op || "EXCLUDE";
		this.values = values;
	};
	SOQL.EXclude.prototype = new SOQL.In();

	// private methods
	var _valueToString = function (val, desc) {
		var v = _.isFunction(val) ? val() : val;
		if (v instanceof SOQL.Date) return v.toString();
		if (_.isNumber(v) || _.isBoolean(v)) return v.toString();
		if (_.isNull(v) || _.isUndefined(v)) return "null";
		if (_.isDate(v)) {
			if (desc.type === "datetime") {
				return Util.date2soqlDatetime(v);
			} else {
				return Util.date2soqlDate(v.value);
			}
		}
		// TODO: location v30.0
		return "'" + Util.soqlEscape(v) + "'";
	};

	var _joinExpression = function (field, op, val, sobject) {
		var v = _.isFunction(val) ? val() : val;
		if (_.isArray(v)) {
			return "(" + _.map(v, function (w) {
				if (_.isArray(w)) return _joinExpression(field, w[0], w[1], sobject);
				if (_.isObject(w)) return _joinExpression(field, w.op || "=", w.value, sobject);
				throw new TypeError('invalid expression');
			}).join(" AND ") + ")";
		} else {
			var desc = sobject.describeField(field);
			return field + " " + op + " " + _valueToString(v, desc);
		}
	};

	// SOQL.Date Object
	SOQL.Date = function (type, n) {
		if (type) {
			var obj = SOQL.Date[type];
			if (obj !== null) {
				var date = new obj(n);
				if (date instanceof SOQL.Date) return date;
			}
			throw new TypeError("Date type error.");
		}
	};

	// SOQL.Date.YESTERDAY Object
	SOQL.Date.YESTERDAY = function () {};
	SOQL.Date.YESTERDAY.prototype = new SOQL.Date();
	SOQL.Date.YESTERDAY.prototype.toString = function () {
		return "YESTERDAY";
	};

	// SOQL.Date.TODAY Object
	SOQL.Date.TODAY = function () {};
	SOQL.Date.TODAY.prototype = new SOQL.Date();
	SOQL.Date.TODAY.prototype.toString = function () {
		return "TODAY";
	};

	// SOQL.Date.TOMORROW Object
	SOQL.Date.TOMORROW = function () {};
	SOQL.Date.TOMORROW.prototype = new SOQL.Date();
	SOQL.Date.TOMORROW.prototype.toString = function () {
		return "TOMORROW";
	};

	// SOQL.Date.LAST_WEEK Object
	SOQL.Date.LAST_WEEK = function () {};
	SOQL.Date.LAST_WEEK.prototype = new SOQL.Date();
	SOQL.Date.LAST_WEEK.prototype.toString = function () {
		return "LAST_WEEK";
	};

	// SOQL.Date.THIS_WEEK Object
	SOQL.Date.THIS_WEEK = function () {};
	SOQL.Date.THIS_WEEK.prototype = new SOQL.Date();
	SOQL.Date.THIS_WEEK.prototype.toString = function () {
		return "THIS_WEEK";
	};

	// SOQL.Date.NEXT_WEEK Object
	SOQL.Date.NEXT_WEEK = function () {};
	SOQL.Date.NEXT_WEEK.prototype = new SOQL.Date();
	SOQL.Date.NEXT_WEEK.prototype.toString = function () {
		return "NEXT_WEEK";
	};

	// SOQL.Date.LAST_MONTH Object
	SOQL.Date.LAST_MONTH = function () {};
	SOQL.Date.LAST_MONTH.prototype = new SOQL.Date();
	SOQL.Date.LAST_MONTH.prototype.toString = function () {
		return "LAST_MONTH";
	};

	// SOQL.Date.THIS_MONTH Object
	SOQL.Date.THIS_MONTH = function () {};
	SOQL.Date.THIS_MONTH.prototype = new SOQL.Date();
	SOQL.Date.THIS_MONTH.prototype.toString = function () {
		return "THIS_MONTH";
	};

	// SOQL.Date.NEXT_MONTH Object
	SOQL.Date.NEXT_MONTH = function () {};
	SOQL.Date.NEXT_MONTH.prototype = new SOQL.Date();
	SOQL.Date.NEXT_MONTH.prototype.toString = function () {
		return "NEXT_MONTH";
	};

	// SOQL.Date.LAST_90_DAYS Object
	SOQL.Date.LAST_90_DAYS = function () {};
	SOQL.Date.LAST_90_DAYS.prototype = new SOQL.Date();
	SOQL.Date.LAST_90_DAYS.prototype.toString = function () {
		return "LAST_90_DAYS";
	};

	// SOQL.Date.NEXT_90_DAYS Object
	SOQL.Date.NEXT_90_DAYS = function () {};
	SOQL.Date.NEXT_90_DAYS.prototype = new SOQL.Date();
	SOQL.Date.NEXT_90_DAYS.prototype.toString = function () {
		return "NEXT_90_DAYS";
	};

	// SOQL.Date.LAST_N_DAYS Object
	SOQL.Date.LAST_N_DAYS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.LAST_N_DAYS.prototype = new SOQL.Date();
	SOQL.Date.LAST_N_DAYS.prototype.toString = function () {
		return "LAST_N_DAYS:" + parseInt(this.n);
	};

	// SOQL.Date.NEXT_N_DAYS Object
	SOQL.Date.NEXT_N_DAYS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.NEXT_N_DAYS.prototype = new SOQL.Date();
	SOQL.Date.NEXT_N_DAYS.prototype.toString = function () {
		return "NEXT_N_DAYS:" + parseInt(this.n);
	};

	// SOQL.Date.THIS_QUARTER Object
	SOQL.Date.THIS_QUARTER = function () {};
	SOQL.Date.THIS_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.THIS_QUARTER.prototype.toString = function () {
		return "THIS_QUARTER";
	};

	// SOQL.Date.LAST_QUARTER Object
	SOQL.Date.LAST_QUARTER = function () {};
	SOQL.Date.LAST_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.LAST_QUARTER.prototype.toString = function () {
		return "LAST_QUARTER";
	};

	// SOQL.Date.NEXT_QUARTER Object
	SOQL.Date.NEXT_QUARTER = function () {};
	SOQL.Date.NEXT_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.NEXT_QUARTER.prototype.toString = function () {
		return "NEXT_QUARTER";
	};

	// SOQL.Date.NEXT_N_QUARTERS Object
	SOQL.Date.NEXT_N_QUARTERS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.NEXT_N_QUARTERS.prototype = new SOQL.Date();
	SOQL.Date.NEXT_N_QUARTERS.prototype.toString = function () {
		return "NEXT_N_QUARTERS:" + parseInt(this.n);
	};

	// SOQL.Date.LAST_N_QUARTERS Object
	SOQL.Date.LAST_N_QUARTERS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.LAST_N_QUARTERS.prototype = new SOQL.Date();
	SOQL.Date.LAST_N_QUARTERS.prototype.toString = function () {
		return "LAST_N_QUARTERS:" + parseInt(this.n);
	};

	// SOQL.Date.THIS_YEAR Object
	SOQL.Date.THIS_YEAR = function () {};
	SOQL.Date.THIS_YEAR.prototype = new SOQL.Date();
	SOQL.Date.THIS_YEAR.prototype.toString = function () {
		return "THIS_YEAR";
	};

	// SOQL.Date.LAST_QUARTER Object
	SOQL.Date.LAST_QUARTER = function () {};
	SOQL.Date.LAST_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.LAST_QUARTER.prototype.toString = function () {
		return "LAST_QUARTER";
	};

	// SOQL.Date.NEXT_QUARTER Object
	SOQL.Date.NEXT_QUARTER = function () {};
	SOQL.Date.NEXT_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.NEXT_QUARTER.prototype.toString = function () {
		return "NEXT_QUARTER";
	};

	// SOQL.Date.NEXT_N_QUARTERS Object
	SOQL.Date.NEXT_N_QUARTERS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.NEXT_N_QUARTERS.prototype = new SOQL.Date();
	SOQL.Date.NEXT_N_QUARTERS.prototype.toString = function () {
		return "NEXT_N_QUARTERS:" + parseInt(this.n);
	};

	// SOQL.Date.LAST_N_QUARTERS Object
	SOQL.Date.LAST_N_QUARTERS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.LAST_N_QUARTERS.prototype = new SOQL.Date();
	SOQL.Date.LAST_N_QUARTERS.prototype.toString = function () {
		return "LAST_N_QUARTERS:" + parseInt(this.n);
	};

	// SOQL.Date.THIS_YEAR Object
	SOQL.Date.THIS_YEAR = function () {};
	SOQL.Date.THIS_YEAR.prototype = new SOQL.Date();
	SOQL.Date.THIS_YEAR.prototype.toString = function () {
		return "THIS_YEAR";
	};

	// SOQL.Date.LAST_YEAR Object
	SOQL.Date.LAST_YEAR = function () {};
	SOQL.Date.LAST_YEAR.prototype = new SOQL.Date();
	SOQL.Date.LAST_YEAR.prototype.toString = function () {
		return "LAST_YEAR";
	};

	// SOQL.Date.NEXT_YEAR Object
	SOQL.Date.NEXT_YEAR = function () {};
	SOQL.Date.NEXT_YEAR.prototype = new SOQL.Date();
	SOQL.Date.NEXT_YEAR.prototype.toString = function () {
		return "NEXT_YEAR";
	};

	// SOQL.Date.NEXT_N_YEARS Object
	SOQL.Date.NEXT_N_YEARS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.NEXT_N_YEARS.prototype = new SOQL.Date();
	SOQL.Date.NEXT_N_YEARS.prototype.toString = function () {
		return "NEXT_N_YEARS:" + parseInt(this.n);
	};

	// SOQL.Date.LAST_N_YEARS Object
	SOQL.Date.LAST_N_YEARS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.LAST_N_YEARS.prototype = new SOQL.Date();
	SOQL.Date.LAST_N_YEARS.prototype.toString = function () {
		return "LAST_N_YEARS:" + parseInt(this.n);
	};

	// SOQL.Date.THIS_FISCAL_QUARTER Object
	SOQL.Date.THIS_FISCAL_QUARTER = function () {};
	SOQL.Date.THIS_FISCAL_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.THIS_FISCAL_QUARTER.prototype.toString = function () {
		return "THIS_FISCAL_QUARTER";
	};

	// SOQL.Date.LAST_FISCAL_QUARTER Object
	SOQL.Date.LAST_FISCAL_QUARTER = function () {};
	SOQL.Date.LAST_FISCAL_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.LAST_FISCAL_QUARTER.prototype.toString = function () {
		return "LAST_FISCAL_QUARTER";
	};

	// SOQL.Date.NEXT_FISCAL_QUARTER Object
	SOQL.Date.NEXT_FISCAL_QUARTER = function () {};
	SOQL.Date.NEXT_FISCAL_QUARTER.prototype = new SOQL.Date();
	SOQL.Date.NEXT_FISCAL_QUARTER.prototype.toString = function () {
		return "NEXT_FISCAL_QUARTER";
	};

	// SOQL.Date.NEXT_N_FISCAL_QUARTERS Object
	SOQL.Date.NEXT_N_FISCAL_QUARTERS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.NEXT_N_FISCAL_QUARTERS.prototype = new SOQL.Date();
	SOQL.Date.NEXT_N_FISCAL_QUARTERS.prototype.toString = function () {
		return "NEXT_N_FISCAL_QUARTERS:" + parseInt(this.n);
	};

	// SOQL.Date.LAST_N_FISCAL_QUARTERS Object
	SOQL.Date.LAST_N_FISCAL_QUARTERS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.LAST_N_FISCAL_QUARTERS.prototype = new SOQL.Date();
	SOQL.Date.LAST_N_FISCAL_QUARTERS.prototype.toString = function () {
		return "LAST_N_FISCAL_QUARTERS:" + parseInt(this.n);
	};

	// SOQL.Date.THIS_FISCAL_YEAR Object
	SOQL.Date.THIS_FISCAL_YEAR = function () {};
	SOQL.Date.THIS_FISCAL_YEAR.prototype = new SOQL.Date();
	SOQL.Date.THIS_FISCAL_YEAR.prototype.toString = function () {
		return "THIS_FISCAL_YEAR";
	};

	// SOQL.Date.LAST_FISCAL_YEAR Object
	SOQL.Date.LAST_FISCAL_YEAR = function () {};
	SOQL.Date.LAST_FISCAL_YEAR.prototype = new SOQL.Date();
	SOQL.Date.LAST_FISCAL_YEAR.prototype.toString = function () {
		return "LAST_FISCAL_YEAR";
	};

	// SOQL.Date.NEXT_FISCAL_YEAR Object
	SOQL.Date.NEXT_FISCAL_YEAR = function () {};
	SOQL.Date.NEXT_FISCAL_YEAR.prototype = new SOQL.Date();
	SOQL.Date.NEXT_FISCAL_YEAR.prototype.toString = function () {
		return "NEXT_FISCAL_YEAR";
	};

	// SOQL.Date.NEXT_N_FISCAL_YEARS Object
	SOQL.Date.NEXT_N_FISCAL_YEARS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.NEXT_N_FISCAL_YEARS.prototype = new SOQL.Date();
	SOQL.Date.NEXT_N_FISCAL_YEARS.prototype.toString = function () {
		return "NEXT_N_FISCAL_YEARS:" + parseInt(this.n);
	};

	// SOQL.Date.LAST_N_FISCAL_YEARS Object
	SOQL.Date.LAST_N_FISCAL_YEARS = function (n) {
		this.n = n;
		return this;
	};
	SOQL.Date.LAST_N_FISCAL_YEARS.prototype = new SOQL.Date();
	SOQL.Date.LAST_N_FISCAL_YEARS.prototype.toString = function () {
		return "LAST_N_FISCAL_YEARS:" + parseInt(this.n);
	};

	// SOSL object
	var SOSL = function (options) {
		this.find = options.find;
		this.in = options.in;
		this.returning = options.returning;
		this.with = options.with;
		this.limit = options.limit;
	};

	SOSL.prototype.clone = function () {
		return new SOSL(this);
	};

	SOSL.prototype.toString = function () {
		return this.toStringFind() +
			this.toStringIn() +
			this.toStringReturning() +
			this.toStringWith() +
			this.toStringLimit();
	};

	SOSL.prototype.toStringFind = function () {
		var find = this.find;
		if (_.isFunction(find)) {
			find = find();
		}
		return "FIND {" + Util.soslEscape(find) + "}";
	};

	SOSL.prototype.toStringIn = function () {
		var fin = this.in;
		if (_.isFunction(fin)) {
			fin = fin();
		}
		if (_.isUndefined(fin)) {
			fin = new SOSL.InSearchGroup.ALL();
		}
		return " IN " + fin;
	};

	// SOSL.InSearchGroup Object
	SOSL.InSearchGroup = function () {};

	// SOSL.InSearchGroup.ALL Object
	SOSL.InSearchGroup.ALL = function () {};
	SOSL.InSearchGroup.ALL.prototype = new SOQL.Date();
	SOSL.InSearchGroup.ALL.prototype.toString = function () {
		return "ALL FIELDS";
	};

	// SOSL.InSearchGroup.EMAIL Object
	SOSL.InSearchGroup.EMAIL = function () {};
	SOSL.InSearchGroup.EMAIL.prototype = new SOQL.Date();
	SOSL.InSearchGroup.EMAIL.prototype.toString = function () {
		return "EMAIL FIELDS";
	};

	// SOSL.InSearchGroup.NAME Object
	SOSL.InSearchGroup.NAME = function () {};
	SOSL.InSearchGroup.NAME.prototype = new SOQL.Date();
	SOSL.InSearchGroup.NAME.prototype.toString = function () {
		return "NAME FIELDS";
	};

	// SOSL.InSearchGroup.PHONE Object
	SOSL.InSearchGroup.PHONE = function () {};
	SOSL.InSearchGroup.PHONE.prototype = new SOQL.Date();
	SOSL.InSearchGroup.PHONE.prototype.toString = function () {
		return "PHONE FIELDS";
	};

	// SOSL.InSearchGroup.SIDEBAR Object
	SOSL.InSearchGroup.SIDEBAR = function () {};
	SOSL.InSearchGroup.SIDEBAR.prototype = new SOQL.Date();
	SOSL.InSearchGroup.SIDEBAR.prototype.toString = function () {
		return "SIDEBAR FIELDS";
	};

	SOSL.prototype.toStringReturning = function () {
		var returning = this.returning;
		if (_.isFunction(returning)) {
			returning = returning();
		}
		if (_.isUndefined(returning)) {
			throw new TypeError("returning null error");
		}
		if (!_.isArray(returning)) returning = [returning];
		return " RETURNING " + _.map(returning, function (r) {
			if (_.isString(r)) return r;
			if (r instanceof SOQL) {
				return r.type + " (" +
					r.toStringFields(r.type) +
					r.toStringWhere(r.type) +
					r.toStringOrderBy() +
					r.toStringLimit() +
				")";
			}
			throw new TypeError("returning type error");
		}).join(", ");
	};

	SOSL.prototype.toStringWith = function () {
		// TODO
		return "";
	};

	SOSL.prototype.toStringLimit = function () {
		var limit = this.limit;
		if (_.isFunction(limit)) {
			limit = limit();
		}
		if (_.isNumber(limit) && limit > 0) {
			return " LIMIT " + limit;
		}
		return "";
	};

	SOSL.prototype.search = function(client, options) {
		var sosl = this.toString();
		console.log("SOSL: " + sosl);
		return client.search(sosl, options)
		.then(function (res) {
			return _toSObjects(res);
		});
	};

	// SObject object
	var SObject = function (type, prefix) {
		if (prefix) {
			type = prefix + "__" + type;
		}

		var SObjectSelf = function (params) {
			var self = this;
			if (_.isObject(params)) {
				_.each(params, function (val, key) {
					if (key === "attributes") return;
					if (key.toLowerCase() === "id") {
						self.id = val;
					} else if (_.isDate(val)) {
						self[_removePrefix(key)] = new Date(val);
					} else {
						self[_removePrefix(key)] = val;
					}
				});
			} else {
				self.id = params;
			}
		};

		var _createParams = function (action) {
			var self = this;
			var vals = {};
			_.each(self, function (val, key) {
				var field = SObjectSelf.describeField(key);
				if (key === "id" || !field) return;
				if (action === "insert") {
					if (!field.createable) return;
				} else {
					if (!field.updateable) return;
				}
				if (_.isFunction(val)) {
					val = val();
				}
				if (_.isDate(val)) {
					if (field.type === "datetime") {
						val = Util.date2soqlDatetime(val);
					} else {
						val = Util.date2soqlDate(val);
					}
				} else if (_.isObject(val)) {
					return;
				}
				vals[field.name] = val;
			});
			return vals;
		};

		var _addFieldNamePrefix = function (name) {
			if (prefix && name.match(/__[crs]$/i)) {
				var prefixedName =  prefix + "__" + name;
				var desc = SObject[type].describeField(prefixedName);
				if (desc) return desc.name;
				var desc = SObject[type].describeField(prefixedName, true);
				if (desc) return desc.relationshipName;
			}
			return name;
		};

		var _addRelationshipNamePrefix = function (name) {
			if (prefix && name.match(/__[r]$/i)) {
				var prefixedName =  prefix + "__" + name;
				var desc = SObject[type].describeChildRelation(prefixedName);
				if (desc) return desc.relationshipName;
			}
			return name;
		};

		var _removePrefix = function (name) {
			if (prefix && name.match(ALL_PREFIX_NAME_REGEXP)) {
				if (RegExp.$1.toLowerCase() === prefix.toLowerCase()) {
					return RegExp.$2;
				}
			}
			return name;
		};

		SObjectSelf.prototype.save = function (options) {
			var self = this;
			if (!self.id) {
				var vals = _createParams.call(self, "insert");
				return SObject.client.create(type, vals, options)
				.done(function (res) {
					self.id = res.id;
				});
			} else {
				var vals = _createParams.call(self, "update");
				return SObject.client.update(type, self.id, vals, options);
			}
		};

		SObjectSelf.upsert = function (options) {
			var self = this;
			options = options || {};
			var externalId = options.externalId || self.id;
			var externalIdField = options.externalIdField || "id";
			if (prefix) _addFieldNamePrefix(externalIdField);
			if (!externalId) throw new TypeError("invalid arguments");
			var vals = _createParams.call(self, "update");
			return SObject.client.upsert(type, externalIdField, externalId, vals, options)
			.done(function (res) {
				if (res) {
					self.id = res.id;
				}
			});
		};

		SObjectSelf.prototype.delete = function (options) {
			var self = this;
			return SObject.client.del(type, self.id, options)
			.done(function () {
				delete self.id;
			});
		};

		SObjectSelf.prototype.clone = function () {
			var self = this;
			var clone = new SObjectSelf(self);
			clone.id = null;
			return clone;
		};

		SObjectSelf.query = function (options) {
			var self = this;
			options = options || {};
			// query
			var soql = new SOQL({
				type: _removePrefix(type),
				prefix: prefix,
				fields: options.fields,
				where: options.where,
				with: options.with,
				groupBy: options.groupBy,
				orderBy: options.orderBy,
				limit: options.limit,
				offset: options.offset
			});
			return soql.query(SObject.client, options);
		};

		SObjectSelf.retrieve = function (options) {
			var self = this;
			options = options || {};
			// fields
			var id = options.id || options.externalId;
			if (!id) throw new TypeError('invalid arguments');
			var externalIdField = options.externalIdField || 'id';
			if (prefix) _addFieldNamePrefix(externalIdField);
			var fields = options.fields;
			if (_.isFunction(fields)) {
				fields = fields();
			}
			if (_.isArray(fields) && fields.length === 0) {
				fields = null;
			}
			if (externalIdField.toLowerCase() !== 'id') {
				id = externalIdField + '/' + id;
			}
			return SObject.client.retrieve(type, id, fields, options)
			.then(function (res) {
				return _toSObject(res, prefix ? true : false);
			});
		};

		var _describe;
		SObjectSelf.describe = function (async) {
			if (_describe) {
				var d = new $.Deferred();
				d.resolve(_describe);
				return d.promise();
			}
			return SObject.client.describe(type, {async: async})
			.then(function (describe) {
				_describe = describe;
				return describe;
			})
		};

		SObjectSelf.describeField = function (fieldName, includeRelationship) {
			var res;
			SObjectSelf.describe(false)
			.then(function (result) {
				var fieldRelations = fieldName.split(".");
				var field = _addFieldNamePrefix(fieldRelations[0]).toLowerCase();
				if (fieldRelations.length === 1) {
					return _.find(result.fields, function (f) {
						var name = f.name;
						if (name.toLowerCase() === field) return true;
						if (includeRelationship && f.relationshipName) {
							return f.relationshipName.toLowerCase() === field;
						}
						return false;
					});
				} else {
					var desc = _.find(result.fields, function (f) {
						if (!f.relationshipName) return false;
						return f.relationshipName.toLowerCase() === field;
					});
					var rtype = desc.referenceTo[0];
					return SObject[rtype].describeField(fieldRelations.slice(1).join("."), true);
				}
			}).done(function (_res) {
				res = _res;
			});
			return res;
		};

		SObjectSelf.getLabel = function (fieldName) {
			var desc = SObjectSelf.describeField(fieldName, true);
			if (desc) return desc.label;
		};

		SObjectSelf.describeFields = function () {
			return SObjectSelf.describe(false)
			.then(function (result) {
				var res = _.reduce(result.fields, function (map, f) {
					var name = f.name;
					map[_removePrefix(name)] = f;
					return map;
				}, {});
				return res;
			});
		};

		SObjectSelf.describeChildRelation = function (relationshipName) {
			var res;
			SObjectSelf.describe(false)
			.then(function (result) {
				relationshipName = _addRelationshipNamePrefix(relationshipName);
				return _.find(result.childRelationships, function (f) {
					if (!f.relationshipName) return false;
					var name = f.relationshipName;
					return name.toLowerCase() === relationshipName.toLowerCase();
				});
			}).done(function (_res) {
				res = _res;
			});
			return res;
		};

		SObjectSelf.metadata = function (options) {
			return SObject.client.metadata(type, options);
		};

		SObjectSelf.recentItems = function (options) {
			return SObjectSelf.metadata(options)
			.then(function (metadata) {
				return _toSObjects(metadata.recentItems, prefix ? true : false);
			})
		};

		SObjectSelf._clear = function () {
			_describe = null;
		};

		SObjectSelf.type = type;
		SObjectSelf.prefix = prefix;

		return SObjectSelf;
	};

	SObject.search = function (options) {
		var self = this;
		options = options || {};
		var sosl = new SOSL({
			find: options.find,
			in: options.in,
			returning: options.returning,
			with: options.with,
			limit: options.limit
		});
		return sosl.search(SObject.client);
	};

	var _toSObjects = function (records, usePrefix) {
		return _.map(records, function (record) {
			return _toSObject(record, usePrefix);
		});
	};

	var _toSObject = function (record, usePrefix) {
		var rtype = record.attributes.type;
		if (rtype === "Name") {
			rtype = record.attributes.url.split("/")[5];
		}

		var data = {};
		_.each(record, function (val, key) {
			if (key === "attributes") return;
			var field = SObject[rtype].describeField(key, true);
			var ftype = field ? field.type : null;
			if (key.toLowerCase() === "id") {
				key = "id";
			} else if (ftype === "int") {
				if (_.isString(val)) val = parseInt(val);
			} else if (ftype === "double") {
				if (_.isString(val)) val = parseFloat(val);
			} else if (ftype === "datetime") {
				if (_.isString(val)) val = Util.soqlDate2datetime(val);
			} else if (ftype === "date") {
				if (_.isString(val)) val = Util.soqlDate2date(val);
			} else if (ftype === "boolean") {
				val = val === "true" ? true : val === "false" ? false : val;
			} else if (_.isObject(val)) {
				if (ftype == "reference") val = _toSObject(val, usePrefix);
				else val = _toSObjects(val.records, usePrefix);
			}
			data[key] = val;
		});
		if (rtype === "AggregateResult") {
			return data;
		} else {
			if (!data.id) {
				var match = record.attributes.url.match(/\/([^\/]+)$/);
				if (match) data.id = match[1];
			}
			if (usePrefix && rtype.match(OBJECT_PREFIX_NAME_REGEXP)) {
				return new SObject.prefix[RegExp.$1][RegExp.$2](data);
			} else {
				return new SObject[rtype](data);
			}
		}
	};

	SObject.initialize = function (client, defaultPrefix) {
		SObject.client = client;
		SObject.defaultPrefix = defaultPrefix;
		return SObject.refresh();
	};

	SObject.refresh = function () {
		return SObject.client.describeGlobal()
		.done(function (result) {
			_.each(result.sobjects, function (s) {
				if (SObject[s.name]) {
					SObject[s.name]._clear();
				} else {
					SObject[s.name] = new SObject(s.name);
				}
				if (s.name.match(OBJECT_PREFIX_NAME_REGEXP)) {
					var prefix = RegExp.$1;
					var name = RegExp.$2;
					if (!SObject.prefix) {
						SObject.prefix = {};
					}
					if (!SObject.prefix[prefix]) {
						SObject.prefix[prefix] = {};
					}
					if (SObject.prefix[prefix][name]) {
						SObject.prefix[prefix][name]._clear();
					} else {
						SObject.prefix[prefix][name] = new SObject(name, prefix);
					}
				}
			});
			return result;
		});
	};

	SObject.apiVersion = function () {
		if (!SObject.client.apiVersion || SObject.client.apiVersion[0] !== "v") {
			return null;
		}
		return parseFloat(SObject.client.apiVersion.slice(1));
	};

	this.SOQL = SOQL;
	this.SOSL = SOSL;
	this.SObject = SObject;
}).call(this.forcetk, jQuery, this._);
