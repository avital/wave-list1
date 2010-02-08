//////////////////////
// Function Tracing //
//////////////////////

var __functionLogDepth = 0;
var __SPACES = "                                                                                  ";
var __LOGGING = true;

var depthLog = function(obj) {
        console.log(__SPACES.substring(0, __functionLogDepth * 2) + obj);
};

Function.implement({
        niceString: function() {
                if (!this._niceString)
                        this._niceString = this.toString().substring(0, 120).replace(/\n/g, ' ');

                return this._niceString;
        },

        log: function() {
                if (__LOGGING) {
                        var self = this;

                        return function() {
                                depthLog('Call: ' + self.niceString());
                                console.log(self);

                                depthLog('Args:');
                                console.log(arguments);

                                try {
                                        __functionLogDepth++;
                                        var result = self.apply(this, arguments);
                                        __functionLogDepth--;
                                        depthLog('Result:');
                                        console.log(result);
                                        return result;
                                }
                                catch (e) {
                                        __functionLogDepth = 0;
                                        throw e;
                                }
                        };
                }
                else {
                        return this;
                }
        }
});


////////////////////
// JS Foundations //
////////////////////

if (typeof console == 'undefined') {
        console = {
                log: function() {
                }
        };
}

shouldntHappen = function() {
        console.log("Shouldn't happen!");
};

function between(x, y) {
        if (x == -Infinity)
	        x = 0;

        return $random(x, y);
};

$extend(JSON, {stringify: JSON.encode, parse: JSON.decode});

function $not(f) {
        return function(x) {
                return !f(x);
        };
};

String.implement({
        beginsWith: function(pre) {
                return this.substring(0, pre.length) == pre;
        },

        allButLast: function() {
                return this.substring(0, this.length - 1);
        }
});

function $begins(prefixes) {
        prefixes = $splat(prefixes);

        return function(str) {
                return prefixes.some(function(prefix) {
                        return str.beginsWith(prefix);
                });
        };
};

Array.implement({
        getAllButLast: function() {
                return this.filter(function(value, i) {
                        return i < this.length - 1;
                }.bind(this));
        },

        isEmpty: function() {
                return this.length == 0;
        },

        oneElement: function() {
                if (this.length != 1)
                        shouldntHappen();

                return this[0];
        },

        conj: function(item) {
	        var clone = $A(this);
	        clone.push(item);
	        return clone;
        }
});

Element.implement({
        $$: Element.getElements,

        $we: function(weid) {
                return this.getElement('[weid=' + weid + ']');
        },

	hide: function() {
	        this.setStyle('display', 'none');
	},

	show: function() {
	        this.setStyle('display', '');
	}
});

Hash.implement({
        filterKeys: function(filter) {
                return this.filter(function(value, key) {
                            return filter(key);
                });
        },

        removeNullValues: function() {
                Hash.each(this, function(value, key) {
                        if (value === null)
                                delete this[key];
                });
        },

        getOrCreate: function(key, defaultVal) {
                if (!this[key])
                        this[key] = defaultVal;

                return this[key];
        }
});


////////////////////////
// Raw State Handling //
////////////////////////

function stateDelta(oldState, newState){
        var diff = {};

        if (oldState) {
	        if (newState) {
	                Hash.each(oldState, function(v1, k1){
		                if (v1 !== newState[k1]){
		                        diff[k1] = newState[k1];
		                }
	                });

                        Hash.each(newState, function(v2, k2){
		                if (oldState[k2] === undefined){
		                        diff[k2] = v2;
		                }
	                });

                        return diff;
	        }
                else {
                        return null;
                }
        }
        else {
                return newState;
        }

        return diff;
}


///////////////////////
// The BIG we object //
///////////////////////

var we = {
        delta: {},
        transactionDepth: 0,

        __submitChanges: function() {
                if (--we.transactionDepth == 0) {
                        // Update local raw state
                        Hash.extend(we.rawState, we.delta);
                        Hash.removeNullValues(we.rawState);

                        // Apply to local we.objects
                        we.applyStateDelta(we.delta);

                        // Send to wave server (on next stateUpdated there will be an empty delta)
                        wave.getState().submitDelta(we.delta);

                        console.log('Delta submitted');
                        console.log(we.delta);

                        we.delta = {};
                }
        },

        __startTransaction: function() {
                we.transactionDepth++;
        },

        runTransaction: function(f) {
                we.__startTransaction();

                try {
                        f();
                }
                finally {
                        we.__submitChanges();
                }
        },

        ////////////////////
        // we.State class //
        ////////////////////
        State: new Class({
                set: function(key, val) {
                        we.runTransaction(function() {
		                we.delta[key.join('.')] = val;
                        });

	                return this;
                },

                unset: function(key) {
                        return this.set(key, null);
                },

                get: function(key) {
                        return this[key.join('.')];
                },

	        getKeys: function() {
	                var result = [];

	                for (var x in this)
		                if (!['caller', '_current', '_'].contains(x) && !(this[x] instanceof Function)) /* $fix? */
		                        result.push(x.split('.'));

	                return result;
	        },

                each: function(f) {
                        var self = this;

                        self.getKeys().each(function(key) {
                                f(self.get(key), key);
                        });
                },

                getClean: function() {
                        var result = {};

                        Hash.each(this, function(val, key) {
                                result[key] = val;
                        });

                        return result;
                },


##########################3

	        ////////////////////////////
	        // Elastic List Functions //
	        ////////////////////////////
	        asArray: function() {
	                var self = this;

                        return self.getKeys().filter($begins('~')).sort(function(a, b) {
		                return parseInt(self[a]._position) > parseInt(self[b]._position) ? 1 : -1;
		        }).map(function(key) {
                                return self[key].data;
		        });
	        },

	        each: function(f) {
	                this.asArray().each(f);
	        },

                remove: function(item) {
                        this.unset(item.id);
                },

	        insertAtPosition: function(pos, obj) {
                        we.runTransaction(function() {
                                var listItem = new we.Object();
                                listItem.set('position', '' + pos);
                                listItem.set('data', obj);
                        });
	        },

	        append: function(obj) {
                        var self = this;

                        we.runTransaction(function() {
	                        obj = obj || new we.Object();

	                        var newPosition = between(self.getKeys().map(function(key) {
                                        return parseInt(self[key]._position)
                                }).max(), 100000000000);

	                        self.insertAtPosition(newPosition, val);
                        });

                        return obj;
	        }
        }),

        objects: {
                // internals
                _: {},

                get: function(id) {
                        if (!this._[id])
                                this._[id] = new we.Object(id);

                        return this._[id];
                }
        },

        applyStateDelta: function(delta) {
                var changedObjIds = [];

                Hash.each(delta, function(val, key) {
                        var tokens = key.split('.');

                        if (tokens.length >= 3) { // this is a real key
                                var type = tokens[0];
                                var objId = tokens[1];
                                var obj = we.objects.get(objId);
                                var keyInObj = tokens[2];

                                changedObjIds.include(objId);

                                if (type == 'obj') {
                                        if (val !== null)
                                                obj[keyInObj] = val;
                                        else
                                                delete obj[keyInObj];
                                }
                                else if (type == 'link') {
                                        var targetObjId = tokens[3];

                                        if (val !== null)
                                                obj.__registerLinkTo(keyInObj, targetObjId);
                                        else
                                                obj.__unregisterLinkTo(keyInObj, targetObjId);
                                }
                        }
                });

                return changedObjIds.map(function(objId) {
                        return we.objects.get(objId);
                });
        }.log(),

        mixinFuncs: {},
        ctx: {},

        renderView: function(__view, __el) {
                __view._el = __el;

                var __oldWeView = we.view;
                we.view = __view;

                __view.each(function(__mixin) {
	                if (__mixin.code) {
                                if (!we.mixinFuncs[__mixin.code])
		                        eval('we.mixinFuncs[__mixin.code] = function() {' + __mixin.code + '};');

                                we.mixinFuncs[__mixin.code]();
	                }
	        });

                we.view = __oldWeView;
        },

        rootSet: function(key, val) {
                we.runTransaction(function() {
                        we.delta[key] = val;
                });
        }
};


/////////////////////////
// Google Wave Interop //
/////////////////////////

function weModeChanged() {
        if (typeof modeChanged != 'undefined') {
	        modeChanged.run(we.lastMode, wave.getMode());
	        we.lastMode = wave.getMode();
	        gadgets.window.adjustHeight();
        }
}

msg = null;
debug = false;

function debugState() {
	if (debug) {
	        if (!msg)  {
		        msg = new gadgets.MiniMessage("http://wave.thewe.net/gadgets/thewe-ggg/thewe-ggg.xml", $('messageBox'));
	        }

	        // for debug
	        msg.createDismissibleMessage(JSON.stringify(we.rawState));
	}
}

function weStateUpdated() {
        var startTime = $time();

        if ((waveState = wave.getState())) {
	        var oldRawState = we.rawState;
                we.rawState = $H(waveState.state_).getClean();
                var changedObjs = we.applyStateDelta(stateDelta(oldRawState, we.rawState));
                var objIdsToRender = [];

                changedObjs.each(function ensureObjectRenders(obj) {
                        if (we.renderTable[obj.id]) {
                                objIdsToRender.include(obj.id);
                        }
                        else {
                                obj._.linksToMe.each(function(obj) {
                                        ensureObjectRenders(obj);
                                });
                        }
                });

                objIdsToRender.each(function(objId) {
                        we.renderView(we.objects.get(objId), we.renderTable[objId]);
                });

                // whats the deal with modeChanged
        }

        console.log('Render time: ' + ($time() - startTime) + 'ms');
	debugState();
        gadgets.window.adjustHeight();
}

function main() {
        if (wave && wave.isInWaveContainer()) {
                window.addEvent('keypress', function(event) {
                        if (event.alt && event.control) {
	                        var key = String.fromCharCode(event.event.charCode);

	                        if (key == 's') {
				        console.log(js_beautify(JSON.stringify(we.objects.get('root').getClean()), {
                                                indent_size: 4,
                                                indent_char: ' ',
                                                preserve_newlines: false
                                        }));
	                        }

	                        if (key == 'o') {
	                                wave.getState().submitValue(
	                                        prompt("Key"),
	                                        prompt("Value"));
	                        }

                                if (key == 'c') {
                                        wave.getState().submitValue('from-key', 'root');
                                        alert('Prototype chosen');
                                }

				if (key == 'e') {
				        alert(eval(prompt("eval")));
				}

				if (key == 'b') {
				        debug = !debug;
				        debugState();
				}

                                if (key == 'j') {
                                        wave.getState().submitValue('blip-rep-keys', (we.objects.get('root').asArray().map(function(x) {
                                                return [x.id, 'code'].join(','); // $fix horrible .code $cursorPath
                                        }).join()));
                                }

				if (key == 'm') {
				        we.runTransaction(function() {
				                var mixinName = prompt("Use an existing mixin? If so, what is its name?");

                                                if (mixinName == undefined)
                                                        return;

                                                var root = we.objects.get('root');

                                                var createNewMixinId = function() {
                                                        return we.__objRawKey(root.append().id, 'code');
                                                };

                                                if (mixinName) {
                                                        var filtered = root.asArray().filter(function(x) {return x._name == mixinName;});

                                                        var fetchMixin = function(mixinId, mixinName) {
                                                                we.rootSet('mixin-rep-key', JSON.stringify({
                                                                        key: mixinId,
                                                                        mixinName: mixinName
                                                                }));
                                                        };

                                                        if (filtered.isEmpty()) {
                                                                // Mixin with requested name doesn't exist - add it
                                                                fetchMixin(createNewMixinId(), mixinName);
                                                        }
                                                        else {
                                                                // Mixin found - replace it with new version
                                                                var mixin = filtered.oneElement();
                                                                fetchMixin(we.__objRawKey(mixin.id, 'code'), mixinName);
                                                        }
                                                } else {
					                we.rootSet('blip-rep-keys', createNewMixinId());
				                }
                                        });
				}

                                if (key == 't') {
                                        wave.getState().submitValue('to-key', '_');
                                        alert('Choose origin by going to the right view and pressing Ctrl-Alt-R');
                                }

                                if (key == 'u') {
                                        var theweJsPath = prompt('URL to thewe.js to use, or none for default');

                                        if (theweJsPath)
                                                Cookie.write('thewe-js-path', theweJsPath);
                                        else
                                                Cookie.dispose('thewe-js-path');
                                }

                                if (key == 'r') {
                                        // $fix: make this work
                                        var xkeys = prompt('Which mixins or mixin fragments? (comma-separated)');

                                        var fromKeys = [];
                                        xkeys.split(',').each(function(xkey) {
                                                var cursor = we.objects.get('root');
                                                var newCursor;
                                                var cursorPath = '_mi.';
                                                var newCursorPath;

                                                xkey.split('.').each(function(x) {
                                                        if (cursor[x]) {
                                                                newCursor = cursor[x];
                                                                newCursorPath = cursorPath + x + '.';
                                                        }
                                                        else {
                                                                cursor.getKeys().each(function(candidate) {
                                                                        if (cursor[candidate]._name == x) {
                                                                                newCursor = cursor[candidate];
                                                                                newCursorPath = cursorPath + candidate + '.';
                                                                        }

                                                                        // $fix: make good each() on we.State

                                                                });
                                                        }

                                                        cursor = newCursor;
                                                        cursorPath = newCursorPath;
                                                });

                                                fromKeys.push(cursorPath.allButLast());
                                                // $fix: write good trim, rtrim, ltrim
                                        });

                                        var fromKey = fromKeys.join();
                                        alert('from-key: ' + fromKey);
                                        wave.getState().submitValue('from-key', fromKey);
                                }
                        }
                });

                we.renderTable = {
                        root: $('content')
                };

                wave.setModeCallback(weModeChanged);
                wave.setStateCallback(weStateUpdated);
        }
};

gadgets.util.registerOnLoadHandler(main);


