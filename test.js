var View = new Class({
        mixin: function(mixin) {
                var self = this;

                $extend(this, Hash.map(mixin, function(val, key) {
                        if ($type(val) == 'function') {
                                var origParent = self[key];

                                return function() {
                                        var oldParent = parent;
                                        parent = origParent;
                                        val.apply(self, arguments);
                                        parent = oldParent;
                                };
                        }
                        else {
                                return val;
                        }
                }));

                if (mixin.init)
                        this.init();
        }
});

X = new View();

X.mixin({
        f: function() {
                alert(1);
        }
});

X.mixin({
        f: function() {
                parent();
                alert(2);
        }
});

X.f();
