////////////////////
// JS Foundations //
////////////////////

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

        applyStateDelta: function(delta) {
                Hash.each(delta, function(val, rawKey) {
                        var key = rawKey.split('.');
                        var oldVal = we.state[rawKey];

                        if (val) {
                                we.state[rawKey] = val;

                                if (oldVal) {
                                        // modified

                                        var id = key[0];
                                        var type = key[1];

                                        if (type == 'pos') {
                                                $(id).inject(itemAfter(val), 'before');
                                        }
                                        else if (type == 'val') {
                                                $(id + '-text').set('text', val);
                                        }
                                }
                                else {
                                        // added

                                        var id = key[0];
                                        var type = key[1];

                                        if (!$(id)) {
                                                var pos = val;

                                                var item = new Element('tr', {'class': 'item', id: id}).setStyle('display', 'none');

                                                var itemRemove = $('remove-proto').clone().inject(item);
                                                var itemRemoveButton = itemRemove.getElements('button').hide();
                                                var itemRemovePlaceholder = new Element('span').inject(itemRemove);

                                                var itemEdit = $('edit-proto').clone().inject(item);
                                                var itemEditButton = itemEdit.getElements('button').hide();
                                                var itemEditPlaceholder = new Element('span').inject(itemEdit);

                                                var itemMove = $('move-proto').clone().inject(item);
                                                var itemMoveButton = itemMove.getElements('.move').hide();
                                                var itemMovePlaceholder = new Element('span').inject(itemMove);

                                                var itemTextCell = new Element('td').inject(item);
                                                var itemText = new Element('span', {'class': 'item-text', id: id + '-text'}).inject(itemTextCell);
                                                var itemTextEdit = new Element('input', {'class': 'edit'}).inject(itemTextCell);

                                                sortables.addItems(item);

                                                itemTextEdit.addEvent('click', function() {
                                                        return false;
                                                });

                                                var saveItem = function() {
                                                        we.state.set([id, 'val'], itemTextEdit.get('value'));
                                                        itemTextEdit.setStyle('display', 'none');
                                                        itemText.setStyle('display', '');
                                                        we.inEditMode = false;
                                                        $(document.body).removeEvent('click', we.globalClickEvent);
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

                                                        itemMoveButton.hide();
                                                        itemMovePlaceholder.show();
                                                };

                                                item.addEvent('mouseover', function() {
                                                        we.onItem = true;

                                                        if (!we.inEditMode) {
                                                                itemText.addClass('selected');
                                                                itemRemoveButton.show();
                                                                itemRemovePlaceholder.hide();

                                                                itemEditButton.show();
                                                                itemEditPlaceholder.hide();

                                                                itemMoveButton.show();
                                                                itemMovePlaceholder.hide();
                                                        }
                                                }).addEvent('mouseout', function() {
                                                        we.onItem = false;

                                                        if (we.newStateWaiting)
                                                                weStateUpdated();

                                                        if (!we.inEditMode) {
                                                                itemText.removeClass('selected');
                                                                hideButtons();
                                                        }
                                                });

                                                itemRemoveButton.addEvent('click', function() {
                                                       we.runTransaction(function() {
                                                               we.state.unset([id, 'pos']);
                                                               we.state.unset([id, 'val']);
                                                       });
                                                });

                                                var editItem = function() {
                                                        we.inEditMode = true;
                                                        hideButtons();

                                                        itemTextEdit.set('value', itemText.get('text'));
                                                        itemTextEdit.setStyle('display', 'block');
                                                        itemText.setStyle('display', 'none');
                                                        itemTextEdit.focus();

                                                        we.globalClickEvent = function() {
                                                                saveItem();
                                                        };

                                                        $(document.body).addEvent('click', we.globalClickEvent);
                                                        return false;
                                                };

                                                itemEditButton.addEvent('click', editItem);
                                                itemText.addEvent('dblclick', editItem);

                                                item.inject($('items-unpositioned'));
                                        }

                                        if (type == 'pos') {
                                                $(id).inject(itemAfter(pos), 'before');
                                        }
                                        else if (type == 'val') {
                                                $(id + '-text').set('text', val);
                                                $(id).setStyle('display', '');
                                        }

                                }
                        }
                        else {
                                // removed

                                delete we.state[rawKey];
                                var id = key[0];

                                if ($(id)) {
                                        sortables.removeItems($(id));
                                        $(id).dispose();
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

        $$('.item').each(function(el) {
                if (!result && (we.state.get([el.id, 'pos']) > pos))
                        result = el;
        });

        return result || $('items-end');
}

function weStateUpdated() {
        var startTime = $time();

        if (we.onItem) {
                we.newStateWaiting = true;
                return;
        }

        if ((waveState = wave.getState())) {
	        var oldRawState = we.rawState;
                we.rawState = $H(waveState.state_).getClean();
                we.applyStateDelta(stateDelta(oldRawState, we.rawState));
                we.newStateWaiting = false;
        }

        gadgets.window.adjustHeight();
}

function main() {
        if (wave && wave.isInWaveContainer()) {
                sortables = new Sortables($('items'), {
//                        handle: '.move',
                        constrain: true,
                        clone: true,

                        onSort: function(el) {
                                var prev = el.getPrevious();
                                var next = el.getNext();

                                var lowerBound = prev ? we.state.get([prev.id, 'pos']) : '0';
                                var upperBound = (next.id != 'items-end') ? we.state.get([next.id, 'pos']) : '1';
                                var newPos = stringBetween(lowerBound, upperBound);

                                we.state.set([el.id, 'pos'], newPos);
                        },

                        onStart: function(el, clone) {
                                clone.getElements('.move').addClass('handclosed');
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


