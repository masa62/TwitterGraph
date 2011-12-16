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
      this.position = [Math.floor(Math.random()*960), Math.floor(Math.random() * 960)];
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
        node.position = [500, 500];
        nodes.push(node);
        var nodecount = 10;
        for (var i = 0; i < nodecount; i ++) {// relation in user.following) {
          var relation = user.following[i];
          var rnode = new Node({id: relation});
          node.relation.push(rnode);
          nodes.push(rnode);
        }

        var count = 0;
        var q = 100000000.0,
            k = 7000.0,
            l = 400.0,
            dt = 0.01,
            m = 1.0,
            dec = 0.2,
            i, j, energy, node1, node2, dx, dy, d, p, speed
            power = [0.0, 0.0];
        do {
          energy = 0;
          for (i = 1; i <= nodecount; i++) {
            node1 = nodes[i];
            power[0] = 0.0;
            power[1] = 0.0;
            for (j = 0; j <= nodecount; j ++) {
              node2 = nodes[j];
              if (node1 === node2) continue;
              dx = node1.position[0] - node2.position[0];
              dy = node1.position[1] - node2.position[1];
              p = dx*dx + dy*dy;
              d = Math.sqrt(p);
              power[0] = power[0] + q / (p * dx / d);
              power[1] = power[1] + q / (p * dy / d);
            }
            for (j = 0; j <= nodecount; j ++) {
              node2 = nodes[j];
              //node2 = node;
              if (node1 === node2) continue;
              dx = node1.position[0] - node2.position[0];
              dy = node1.position[1] - node2.position[1];
              d = Math.sqrt(dx*dx+dy*dy);
              power[0] = power[0] - k * (d - l) * (dx / d);
              power[1] = power[1] - k * (d - l) * (dy / d);
            }
            node1.speed[0] = (node1.speed[0] + dt * power[0] / m) * dec;
            node1.speed[1] = (node1.speed[1] + dt * power[1] / m) * dec;
            //console.log("speed: " + node1.speed[0]);
            //console.log("before: " + node1.position[0] + ", " + node1.position[1]);
            node1.position[0] = node1.position[0] + dt * node1.speed[0];
            node1.position[1] = node1.position[1] + dt * node1.speed[1];
            speed = Math.sqrt(node1.speed[0]*node1.speed[0] + node1.speed[1]*node1.speed[1]);
            //console.log("after: " + node1.position[0] + ", " + node1.position[1]);
            energy = energy + m * Math.sqrt(speed);
          }
          count ++;
          //console.log("energy: " + energy);
        } while(count < 10000);
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
