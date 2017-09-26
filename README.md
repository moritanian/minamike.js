minamike.js
===================

[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

#### このライブラリに過度な期待はしないでください ####

enable javascript to override and overload.

[Examples](https://moritanian.github.io//minamike.js/)

### Usage ###


```javascript
function Vector3(x, y, z){

  this.x = x || 0;
  this.y = y || 0;
  this.z = z || 0;

  this.getString = function(){
    return 
`{
  x: ${this.x},
  y: ${this.y},
  z: ${this.z}
}`;
  };

  // operator overload
  Vector3.prototype.__operators__ = {
    '+' : function(v1, v2){
      return new Vector3(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
    },
    '-' : function(v1, v2){
      return new Vector3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
    },
    '*' : function(v1, v2){ // inner product
      return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    },
    '^' : function(v1, v2){ // exterior product
      return new Vector3(
        v1.y * v2.z - v1.z * v2.y,
        v1.z * v2.x - v1.x * v2.z,
        v1.x * v2.y - v1.y * v2.x
      );
    }
  };

}

var func = function(){
  
  var vec1 = new Vector3(1,2,3);
  var vec2 = new Vector3(2,3,4);

  var vec3 = vec1 - vec2;
  var vec4 = vec1 ^ vec2;

  console.log(vec3.getString());
  console.log(vec4.getString());

};

(new minamike(func)).exec(); 
/* => 
  Vector3(-1,-1,-1), 
  Vector3(-1, 2, -1)
*/

```

### build ###
```
gulp
```
