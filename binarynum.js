leftShift = function(a, b) {
  var x = dup(a)
  x = expand(x, x.length + (b * 6 / 15), 0)
  leftShift_(x, b * 6)
  return x
}  

BinaryNum = {
  add: function(a, b) {
    return {
      numerator: add(leftShift(a.numerator, b.denominatorPower), leftShift(b.numerator, a.denominatorPower)),
      denominatorPower: a.denominatorPower + b.denominatorPower
    }
  },

  subtract: function(a, b) {
    return {
      numerator: sub(leftShift(a.numerator, b.denominatorPower), leftShift(b.numerator, a.denominatorPower)),
      denominatorPower: a.denominatorPower + b.denominatorPower
    }
  },
  
  multiply: function(a, b) {
    return {
      numerator: mult(a.numerator, b.numerator),
      denominatorPower: a.denominatorPower + b.denominatorPower
    }
  },
  
  rand: function() {
    var TOLERANCE = 1
    
    return {
      numerator: int2bigInt($random(1, (1 << (TOLERANCE * 6)) - 1), 1, 1),
      denominatorPower: TOLERANCE
    }
  },

  between: function(a, b) {
    return this.add(a, this.multiply(this.rand(), this.subtract(b, a)))
  },
  
  toString: function(a) {
    result = bigInt2str(a.numerator, 64)
    return ('0'.repeat(1 + a.denominatorPower - result.length) + result).replace(/0+$/, ''); 
  },
  
  fromString: function(s) {
    return {
      numerator: str2bigInt(s, 64, 1, 1),
      denominatorPower: s.length - 1
    }
  }
}

$bn = BinaryNum

stringBetween = function(s1, s2) {
  return $bn.toString($bn.between($bn.fromString(s1), $bn.fromString(s2)))
}

testBn = function(x) {
  if ($bn.toString($bn.fromString(x)) == x)
    console.log('testBn: Success')
  else
    throw 'testBn: FAILED!'
}

test = function(x, y, n) {
  if (n <= 0)
    return

  console.log("stringBetween('" + x + "', '" + y + "')")

  testBn(y)
      
  var z = stringBetween(x, y)
  console.log(z)
  
  if (z < y && z > x)
    console.log('Success')
  else {
    console.log('FAIL!')
    return
  }

  if ($random(0, 1))
    test(z, y, n-1)
  else
    test(x, z, n-1)
}
