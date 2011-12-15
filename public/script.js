(function () {
  window.onload = function () {

    var User = function (name) {
      this.name = name;
      this.relation = [];
    }
    User.prototype = {
      relationship: function (user, value) {
        this.relation.push({user: user, value: value});
      }
    }
    var canvas = document.getElementsByTagName("canvas")[0];
    var context = canvas.getContext('2d');

    function Node(options) {
      this.speed = [0, 0];
      this.position = [Math.floor(Math.random()*960), Math.floor(Math.random() * 460)];
      this.id = options.id;
      this.img = options.img || "";
      this.name = options.screen_name || "test";
      this.relation = [];
    }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/user/" + myid);
    xhr.onreadystatechange = function () {
      console.log(xhr.status);
      if (xhr.readyState === 4 && xhr.status === 200) {
        var user = JSON.parse(xhr.responseText);
        // ここで解析しながらグラフを描く
        /*
        var img = new Image();
        img.src = user.img;
        context.drawImage(img, 0, 0);
        */
        var nodes = [];
        var node = new Node({id: myid, screen_name: myname, img: user.img});
        node.position = [500, 250];
        nodes.push(node);
        var nodecount = 10;
        for (var i = 0; i < nodecount; i ++) {// relation in user.following) {
          var relation = user.following[i];
          var rnode = new Node({id: relation});
          node.relation.push(rnode);
          nodes.push(rnode);
        }

        var count = 0;
        do {
          var energy = 0;
          for (var i = 1; i < nodecount; i++) {
            var node1 = nodes[i];
            power = [0.0,0.0];
            var g = 500.0;
            for (var j = 0; j < nodecount; j ++) {
              var node2 = nodes[j];
              if (node1 === node2) continue;
              power[0] = power[0] + g / Math.pow(node1.position[0] - node2.position[0],2);
              power[1] = power[1] + g / Math.pow(node1.position[1] - node2.position[1],2);
            }
            var k = 0.7;
            var l = 100.0;
            for (var j = 0; j < nodecount; j ++) {
              var node2 = nodes[j];
              if (node1 === node2) continue;
              power[0] = power[0] + k * (Math.abs(node1.position[0] - node2.position[0]) - l);
              power[1] = power[1] + k * (Math.abs(node1.position[1] - node2.position[1]) - l);
            }
            var dt = 0.1;
            var m = 1.0;
            node1.speed[0] = (node1.speed[0] + dt * power[0] / m) * 0.01;
            node1.speed[1] = (node1.speed[1] + dt * power[1] / m) * 0.01;
            node1.position[0] = node1.position[0] + dt * node1.speed[0];
            node1.position[1] = node1.position[1] + dt * node1.speed[1];
            energy = energy + m * (node1.speed[0]*node1.speed[0] + node1.speed[1] * node1.speed[1]);
          }
          count ++;
          console.log("energy: " + energy);
        } while(count < 100)//energy > 100);
        console.log(count);
        for (var i = 0; i < nodes.length; i ++) {
          var node1 = nodes[i];
          var img = new Image();
          img.src = user.img;
          context.drawImage(img, node1.position[0], node1.position[1]);
        }
      }
    };
    xhr.send(null);
  }
})();
