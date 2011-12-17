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

    var phase = 0;

    function Node(options) {
      this.speed = [0, 0];
      this.position = [0, 0];
      this.id = options.id;
      this.img = options.img || "";
      this.name = options.screen_name || "test";
      this.relation = [];
    }

    var nodes = [];

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/user/" + myid);
    xhr.onreadystatechange = function () {

      if (xhr.readyState != 4 || xhr.status != 200) {
        return;
      }
      console.log(xhr);

      console.log(xhr.getAllResponseHeaders());
      
      var user = JSON.parse(xhr.responseText);
      // ここで解析しながらグラフを描く
      var node = new Node({id: myid, screen_name: myname, img: user.img});
      node.position = [476, 476];
      nodes.push(node);
    }
    xhr.send(null);

    var xhr2 = new XMLHttpRequest();
    xhr2.open("GET", "/friends/" + myid);
    xhr2.onreadystatechange = function () {
      if (xhr2.readyState !=4 || xhr2.status != 200) {
        return;
      }
      if (xhr2.status === 404) {
        return;
      }
      var user_info = JSON.parse(xhr2.responseText);
      console.log(user_info);
      for (var i = 0; i < user_info.length; i ++) {
        var r = user_info[i];
        console.log(r.id);
        var rnode = new Node({id: r.id, img: r.img, screen_name: r.screen_name});
        console.log(rnode);
        var xoffset = 100,
            yoffset = 100;
        switch (phase) {
          case 0:
            break;
          case 1:
            xoffset += 500.0;
            break;
          case 2:
            yoffset += 500.0;
            break;
          case 3:
            xoffset += 500.0;
            yoffset += 500.0;
            break;
        }
        phase = (phase+1)%4;
        rnode.position[0] = Math.floor(Math.random()*400) + xoffset;
        rnode.position[1] = Math.floor(Math.random()*400) + yoffset;
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
          power = [0.0, 0.0],
          nodecount = user_info.length;
      var pre_energy = 10000000000;
      do {
        energy = 0;
        for (i = 1; i < nodecount; i++) {
          node1 = nodes[i];
          power[0] = 0.0;
          power[1] = 0.0;
          for (j = 0; j < nodecount; j ++) {
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
        var diff = Math.abs(pre_energy - energy);
        pre_energy = energy;
      } while(diff > 0.000001);
      console.log(count);


      var relation_xhr = new XMLHttpRequest();
      relation_xhr.open("GET", "/relation/"+myid);
      relation_xhr.onreadystatechange = function () {
        if (relation_xhr.status != 200 || relation_xhr.readyState != 4) {
          return;
        }
        console.log("drawing");
        var relation = JSON.parse(relation_xhr.responseText);
        var sx = nodes[0].position[0],
            sy = nodes[0].position[1];
        console.log(sx + ", " + sy);
        for (var i = 1; i < nodes.length; i ++) {
          var ex = nodes[i].position[0],
              ey = nodes[i].position[1],
              uid = nodes[i].id;
          var r;
          console.log("finding: " + uid);
          for (var j = 0; j < relation.length; j ++) {
            console.log("search: " + relation[j].to);
            if (relation[j].to === uid) {
              console.log("found: " + uid);
              r = relation[j];
               break;
            }
          }
          if (!r) {
            console.log("no relation");
            continue;
          }
          var color = "red";
          context.lineWidth = 10;
          context.beginPath();
          context.moveTo(sx, sy);
          context.lineTo(ex, ey);
          context.stroke();
        }
        for (var i = 0; i < nodes.length; i ++) {
          var node1 = nodes[i];
          if (node1.img) {
            var img = new Image();
            img.src = nodes[i].img;
            context.drawImage(img, node1.position[0]-24, node1.position[1]-24);
            context.fillText(node1.name, node1.position[0]-24, node1.position[1]-24);
          }
          else {
            (function (node1) {
              var img_request = new XMLHttpRequest();
              img_request.open("GET", "/img/" + node1.id);
              img_request.onreadystatechange = function () {
                if (img_request.status != 200 || img_request.readyState != 4) {
                  return;
                }
                var user = JSON.parse(img_request.responseText);
                console.log(user);
                var img = new Image();
                img.src = user.img;
                context.drawImage(img, node1.position[0]-24, node1.position[1]-24);
                context.fillText(user.screen_name, node1.position[0]-24, node1.position[1]-24);
              }
              img_request.send(null);
            })(node1);
          }
        }
      }
      relation_xhr.send(null);
    }
    xhr2.send(null);
  }

})();
