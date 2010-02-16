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

// Make MooTools' JSON object with in Wave
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
        $we: function(weid) {
                return this.getElement('[weid=' + weid + ']');
        },

	hide: function() {
	        this.setStyle('visibility', 'hidden');
                return this;
	},

	show: function() {
	        this.setStyle('visibility', '');
                return this;
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
		                        diff[k1] = newState[k1] || null;
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
        laterDelta: {},
        transactionDepth: 0,
        ignoreInIncomingDelta: {},

        __submitChanges: function() {
                if (--we.transactionDepth == 0) {
                        Hash.extend(we.ignoreInIncomingDelta, we.delta);

                        we.isLocalModification = true;
                        we.applyStateDelta(we.delta, we.state);
                        we.isLocalModification = false;

                        console.log('Outgoing delta:');
                        console.log(deltaToString(we.delta));
                        console.log();

                        wave.getState().submitDelta(we.delta);

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

                newId: function() {
                        return '' + $random(0, 1000000000); // $fix
                },

                insertAtPosition: function(pos, val) {
                        var self = this;
                        var id = self.newId();

                        we.runTransaction(function() {
                                self.set([id, 'pos'], pos);
                                self.set([id, 'val'], val);
                        });
	        },

	        append: function(val) {
                        var self = this;

                        we.runTransaction(function() {
                                var maxPos = '0';

                                self.getKeys().filter(function(key) {
                                        return key[1] == 'pos';
                                }).map(function(key) {
                                        return self.get(key);
                                }).each(function(pos) {
                                        if (pos > maxPos)
                                                maxPos = pos;
                                });

	                        var newPosition = stringBetween(maxPos, '1');

	                        self.insertAtPosition(newPosition, val);
                        });
	        }
        }),

        applyStateDelta: function(delta, oldState) {
                Hash.each(delta, function(val, rawKey) {
                        var key = rawKey.split('.');
                        var oldVal = oldState[rawKey];

                        if (val) {
                                if (oldVal) {
                                        // modified

                                        var id = key[0];
                                        var type = key[1];

                                        if (type == 'pos') {
                                                if (((we.onItem &&
                                                     (((oldVal <= oldState.get([we.onItem, 'pos'])) && (val > oldState.get([we.onItem, 'pos']))) ||
                                                      ((oldVal >= oldState.get([we.onItem, 'pos'])) && (val < oldState.get([we.onItem, 'pos']))))) ||
                                                    we.isMoving) &&
                                                    !we.isLocalModification) {
                                                        we.laterDelta[rawKey] = val;
                                                        showLaterDeltaNotify();
                                                } else {
                                                        we.state[rawKey] = val;
                                                        $(id).inject(itemAfter(val), 'before');
                                                }
                                        }
                                        else if (type == 'val') {
                                                if (we.isMoving && we.onItem == id) {
                                                        we.laterDelta[rawKey] = val;
                                                } else {
                                                        we.state[rawKey] = val;
                                                        $(id + '-text').set('text', val);
                                                }
                                        }
                                }
                                else {
                                        // added

                                        we.state[rawKey] = val;

                                        var id = key[0];
                                        var type = key[1];

                                        if (!$(id)) {
                                                var item = new Element('tr', {'class': 'item', id: id}).setStyle('display', 'none');

                                                var itemRemove = $('remove-proto').clone().inject(item);
                                                var itemRemoveButton = itemRemove.getElements('button').hide();
                                                var itemRemovePlaceholder = new Element('span').inject(itemRemove);

                                                var itemEdit = $('edit-proto').clone().inject(item);
                                                var itemEditButton = itemEdit.getElements('button').hide();
                                                var itemEditPlaceholder = new Element('span').inject(itemEdit);

                                                var itemTextCell = new Element('td', {'class': 'item-text-cell ' + (we.inEditMode ? '' : 'handopen')}).inject(item);
                                                var itemText = new Element('div', {'class': 'item-text', id: id + '-text'}).inject(itemTextCell);
                                                var itemTextEdit = new Element('input', {'class': 'edit'}).inject(itemTextCell);

                                                sortables.addItems(item);

                                                itemTextEdit.addEvent('click', function() {
                                                        return false;
                                                });

                                                var saveItem = function() {
                                                        var newVal = itemTextEdit.get('value');

                                                        if (newVal == '') {
                                                                we.runTransaction(function() {
                                                                        we.state.unset([id, 'pos']);
                                                                        we.state.unset([id, 'val']);
                                                                });
                                                        } else {
                                                                we.state.set([id, 'val'], newVal);
                                                                itemTextEdit.setStyle('display', 'none');
                                                                itemText.setStyle('display', '');
                                                        }

                                                        we.inEditMode = false;
                                                        $$('.item-text-cell').addClass('handopen');
                                                        $(document.body).removeEvent('click', we.globalClickEvent);
                                                        we.globalClickEvent = null;
                                                        mouseleave();
                                                };

                                                itemTextEdit.addEvent('keypress', function(event) {
                                                        if (event.key == 'enter') {
                                                                saveItem();
                                                        }
                                                });

                                                var hideButtons = function() {
                                                        itemRemoveButton.hide();
                                                        itemRemovePlaceholder.show();

                                                        itemEditButton.hide();
                                                        itemEditPlaceholder.show();
/*
                                                        itemMoveButton.hide();
                                                        itemMovePlaceholder.show();
*/
                                                };

                                                item.store('delete', function() {
                                                        hideButtons();
                                                        itemText.removeEvent('dblclick', editItem);
                                                        item.removeEvent('mouseover', mouseover);
                                                        itemText.setStyle('text-decoration', 'line-through');
                                                        itemText.setStyle('color', 'red');
                                                });

                                                var mouseover = function() {
                                                        if (!we.inEditMode && !we.isMoving) {
                                                                if (we.onItem)
                                                                        $(we.onItem).retrieve('mouseleave')();

                                                                we.onItem = id;

                                                                itemText.addClass('selected');
                                                                itemRemoveButton.show();
                                                                itemRemovePlaceholder.hide();

                                                                itemEditButton.show();
                                                                itemEditPlaceholder.hide();
/*
                                                                itemMoveButton.show();
                                                                itemMovePlaceholder.hide();
*/
                                                        }
                                                };

                                                var mouseleave = function() {
                                                        if (!we.inEditMode && !we.isMoving) {
                                                                we.onItem = null;
                                                                itemText.removeClass('selected');
                                                                hideButtons();
                                                                applyLaterDelta();
                                                        }
                                                };

                                                item.store('hideButtons', function() {
                                                        hideButtons();
                                                });

                                                item.addEvent('mouseover', mouseover).addEvent('mouseleave', mouseleave);
                                                item.store('mouseover', mouseover).store('mouseleave', mouseleave);

                                                itemRemoveButton.addEvent('click', function() {
                                                        we.runTransaction(function() {
                                                                we.state.unset([id, 'pos']);
                                                                we.state.unset([id, 'val']);
                                                        });
                                                });

                                                var editItem = function() {
                                                        we.inEditMode = true;
                                                        $$('.item-text-cell').removeClass('handopen');

                                                        hideButtons();

                                                        itemTextEdit.set('value', itemText.get('text'));
                                                        itemTextEdit.setStyle('display', 'block');
                                                        itemText.setStyle('display', 'none');
                                                        itemTextEdit.focus();

                                                        we.globalClickEvent = saveItem;
                                                        $(document.body).addEvent('click', we.globalClickEvent);
                                                        return false;
                                                };

                                                itemEditButton.addEvent('click', editItem);
                                                itemText.addEvent('dblclick', editItem);

                                                item.inject($('items-unpositioned'));
                                        }

                                        if (type == 'pos') {
                                                console.log(id + ' placed before ' + itemAfter(val).id);
                                                $(id).inject(itemAfter(val), 'before');
                                        }
                                        else if (type == 'val') {
                                                $(id + '-text').set('text', val);
                                                $(id).setStyle('display', '');
                                        }

                                }
                        }
                        else {
                                // removed
                                var id = key[0];

                                if ($(id)) {
                                        if (((we.onItem && (we.state.get([id, 'pos']) <= we.state.get([we.onItem, 'pos']))) || we.isMoving) &&
                                            !we.isLocalModification) {
                                                $(id).retrieve('delete')();

                                                we.laterDelta[rawKey] = val;
                                                showLaterDeltaNotify();
                                        }
                                        else {
                                                delete we.state[rawKey];

                                                var item = $(id);
                                                if (item) {
                                                        var next = item.getNext();

                                                        sortables.removeItems($(id));
                                                        $(id).dispose();

                                                        if (we.isLocalModification) {
                                                                if (next.id == 'items-end') {
                                                                        we.onItem = null;
                                                                } else {
                                                                        we.onItem = next.id;
                                                                        next.retrieve('mouseover')();
                                                                }
                                                        }
                                                }
                                        }
                                }
                        }
                });
        },

        rootSet: function(key, val) {
                we.runTransaction(function() {
                        we.delta[key] = val;
                });
        }
};

we.state = new we.State();


/////////////////////////
// Google Wave Interop //
/////////////////////////

msg = null;
debug = false;

function itemAfter(pos) {
        var result = null;

        // @later: Could make more efficient with AVL tree
        $$('.item').each(function(el) {
                if (!result && (we.state.get([el.id, 'pos']) > pos))
                        result = el;
        });

        return result || $('items-end');
}

function showLaterDeltaNotify() {
        if (!we.isMoving)
                $('notify').set('text', we.inEditMode ? 'Finish editing to see updates' : 'Move cursor to see updates')
                .setStyle('top', $(we.onItem).getPosition().y).fade('in');
}

function hideLaterDeltaNotify() {
        $('notify').fade('out');
}

function applyLaterDelta() {
        if (Hash.getLength(we.laterDelta) > 0) {
                var origLaterDelta = $H(we.laterDelta).getClean();
                we.laterDelta = {};
                we.applyStateDelta(origLaterDelta, we.state);

                if (Hash.getLength(we.laterDelta) == 0)
                        hideLaterDeltaNotify();

                gadgets.window.adjustHeight();
        }
}

function deltaToString(delta) {
        return Hash.map(delta, function(val, key) {
                return key + ": " + val;
        }).getValues().join('\n');
}

function weStateUpdated() {
        var startTime = $time();

        if ((waveState = wave.getState())) {
                console.log('weStateUpdated:');
                console.log(deltaToString(waveState.state_));
                console.log();

	        var oldServerState = we.serverState || new we.State();
                we.serverState = new we.State();
                Hash.extend(we.serverState, waveState.state_);

                var delta = stateDelta(oldServerState, we.serverState);

                console.log('Incoming delta:');
                console.log(deltaToString(delta));
                console.log();

                console.log('To ignore:');
                console.log(deltaToString(we.ignoreInIncomingDelta));
                console.log();

                // ignore any elements in the delta with the same key as something that the user originally generated
                Hash.each(we.ignoreInIncomingDelta, function(val, key) {
                        if (delta[key] !== undefined) {
                                if (delta[key] == val)
                                        delete delta[key];

                                delete we.ignoreInIncomingDelta[key];
                        }
                });

                // if we got a modification on the same key as something in we.laterDelta then we should ignore
                // the original value in we.laterDelta
                Hash.each(delta, function(val, key) {
                        delete we.laterDelta[key];
                });

                console.log('Intermediate:');
                console.log(deltaToString(delta));
                console.log();

                console.log('Incoming delta after cleaning:');
                console.log(deltaToString(delta));
                console.log();

                we.applyStateDelta(delta, oldServerState);

                // @Q could this be more generic somehow? this same code appears in applyLaterDelta()
                if (Hash.getLength(we.laterDelta) == 0)
                        hideLaterDeltaNotify();

                gadgets.window.adjustHeight();
        }
}

function main() {
        if (wave && wave.isInWaveContainer()) {
                window.addEvent('keyup', function(event) {
                        if (event.alt && event.control) {
                                if (event.key == 'e') {
                                        alert(eval(prompt("eval")));
                                } else if (event.key == 'a') {
                                        // add a new item each 5 seconds
                                        var item = 1;

                                        constantAppendTimer = (function() {
                                                we.state.append('' + (item++));
                                        }).periodical(3500);
                                } else if (event.key == 's') {
                                        $clear(constantAppendTimer);
                                }
                        }
                });

                sortables = new Sortables($('items'), {
                        handle: '.item-text',
                        constrain: true,
                        clone: true,

                        onComplete: function(el) {
                                we.isMoving = false;

                                if (this.origPrev !== undefined && (el.getPrevious() != this.origPrev)) {
                                        var prev = el.getPrevious();
                                        var next = el.getNext();

                                        var lowerBound = prev ? we.state.get([prev.id, 'pos']) : '0';
                                        var upperBound = (next.id != 'items-end') ? we.state.get([next.id, 'pos']) : '1';
                                        var newPos = stringBetween(lowerBound, upperBound);

                                        applyLaterDelta();

                                        we.state.set([el.id, 'pos'], newPos);
                                } else {
                                        applyLaterDelta();
                                }

                                this.origPrev = undefined;
                        },

                        onStart: function(el, clone) {
                                if (we.globalClickEvent)
                                        we.globalClickEvent();

                                el.retrieve('hideButtons')();
                                we.isMoving = true;
                                this.origPrev = el.getPrevious();

                                clone.getElements('.item-text-cell').addClass('handclosed').addClass('move-clone');
                                clone.getElements('button').hide();
                        }
                });

                $('new').addEvent('keypress', function(event) {
                        if (event.key == 'enter') {
                                var val = $('new').get('value');
                                if (val != '') {
                                        we.state.append(val);
                                        $('new').set('value', '');
                                }
                        }
                });

                wave.setStateCallback(weStateUpdated);
        }
};

gadgets.util.registerOnLoadHandler(main);


