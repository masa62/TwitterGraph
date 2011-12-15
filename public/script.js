(function () {
  window.onload = function () {
    var socket = io.connect('http://localhost:3080/');
    socket.emit('cookie', {cookie: document.cookie});

    var User = function (name) {
      this.name = name;
      this.relation = [];
    }
    User.prototype = {
      relationship: function (user, value) {
        this.relation.push({user: user, value: value});
      }
    }

    var userset = {};
    socket.on('user', function (data) {
      console.log('user event available');
      var json = JSON.parse(data);
      console.log(json);
      var img = document.createElement('img');
      document.body.appendChild(img);
      img.src = json.img;
    });

    var me = new User(myname);
    userset[myname] = me;

    function sketchProc(processing) {
      processing.setup = function () {
        processing.size(1020, 520);
        processing.noLoop();
        processing.stroke(0);
        processing.fill(0);
      }
      processing.draw = function () {
      }
      processing.drawmetext = function (text, x, y) {
        processing.text(text, processing.width / 2, processing.height / 2);
      }
      var cols = 0, rows = 0;
      processing.drawuser = function (user) {
        console.log(user.name);
        var x = cols * 150 + 10;
        var y = rows * 150 + 10;
        if (rows == 2) {
          y = 500 - 150 - 10;
        }
        processing.text(user.name, x, y);
        cols ++;
        if (rows == 2 && cols == 4) {
          cols = 6;
        }
        if (cols == 6) {
          cols = 0;
          if (rows === 0) {
            rows = 2;
          }
        }
      }
    }
    var canvas = document.getElementsByTagName("canvas")[0];
    var p = new Processing(canvas, sketchProc);
    p.drawmetext(myname);
  }
})();
