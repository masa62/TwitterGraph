var express = require('express'),
    app = express.createServer(),
    oauth = new (require('oauth').OAuth)(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      'pa6CKYWmoYVSCR4HGWiXA',
      'fhdSlgkVQ9WnqPB1ZbsW6YOe82jPS7b6QY6cer6qWo',
      '1.0',
      'http://localhost:3000/auth/twitter/callback',
      'HMAC-SHA1'
    ),
    url = require('url'),
    http = require('http'),
    request = require('request'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**** mongodbの設定開始 ****/

mongoose.connect('mongodb://localhost/twitrelation');

var User = new Schema({
  id: String,
  screen_name: String,
  img: String,
  following: [String],
  last_up_date: Date
});

mongoose.model('User', User);
User = mongoose.model('User');

var Relation = new Schema({
  to: String,
  from: String,
  score: Number
});

mongoose.model('Relation', Relation);
Relation = mongoose.model('Relation');

/**** mongodbの設定ここまで ****/

app.configure(function () {
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.static(__dirname + '/public'));
  app.use(express.session({
    secret: "secret",
  }));
  app.set('view engine', 'ejs');
});

app.dynamicHelpers({
  session: function (req, res) {
    return req.session;
  }
});

app.get('/', function (req, res) {
    res.render('index', {layout: false});
});

/****oauth関連ここから****/
/**
 * oauth認証を行う
 */
app.get('/auth/twitter', function (req, res) {
  oauth.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results){
    if (error) {
      res.send(error);
    }
    else {
      req.session.oauth = {};
      req.session.oauth.token = oauth_token;
      req.session.oauth.token_secret = oauth_token_secret;
      res.redirect('http://twitter.com/oauth/authenticate?oauth_token=' + oauth_token);
    }
  });
});

/**
 * oauth認証後に呼ばれる
 */
app.get('/auth/twitter/callback', function (req, res) {
  if (!req.session.oauth) {
    res.redirect("/");
    return;
  }

  req.session.oauth.verifier = req.query.oauth_verifier;
  oauth.getOAuthAccessToken(req.session.oauth.token, req.session.oauth.token_secret, req.session.oauth.verifier,
    function (error, oauth_access_token, oauth_access_token_secret, results) {
      if (error) {
        res.send(error);
      }
      else {
        req.session.oauth.access_token = oauth_access_token;
        req.session.oauth.access_token_secret = oauth_access_token_secret;
        req.session.user_profile = results;

        var oa = req.session.oauth;
        var id = results.user_id;

        function analysis_mention(err, data) {
          var json = JSON.parse(data);
          Relation.find({from: id}, function (err, docs) {
            var relations = {};
            for (var i = 0; i < docs.length; i ++) {
              relations[docs[i].to] = docs[i];
            }
            for (var i = 0; i < json.length; i ++) {
              var entry = json[i];
              var uid = entry["in_reply_to_user_id"];
              if (!uid) {
                continue;
              }
              if (!relations[uid]) {
                relations[uid] = new Relation({score: 0});
                relations[uid].to = uid;
                relations[uid].from = id;
              }
              relations[uid].score = relations[uid].score + 1;
            }
            for (var uid in relations) {
              if (uid === 'img') {
                continue;
              }
              if (relations[uid].score === 0) {
                continue;
              }
              relations[uid].save();
            }
            res.redirect('/');
          });
        }

        function analysis_following(err, data) {
          var json = JSON.parse(data);
          var ids = json.ids;
          // 一度フォロワーを全削除してからもう一度登録しなおす
          var following = [];
          for (var i in ids) {
            following.push(ids[i]);
          }
          me.following = following;
          me.save();

          oauth.get("http://api.twitter.com/1/statuses/user_timeline.json?count=200", 
              oa.access_token,
              oa.access_token_secret, 
              analysis_mention);
        }

        function analysis() {
          oauth.get("http://api.twitter.com/1/friends/ids.json", 
              oa.access_token,
              oa.access_token_secret, 
              analysis_following);
        }

        // 画像をゲットしてそれのcallbackにすること
        var me = null;
        
        User.find({id: id}, function (err, docs) {
          if (!docs[0]) {
            console.log("new user created");
            request({
                uri: 'https://api.twitter.com/1/users/profile_image?screen_name=' + results.screen_name + '&size=normal',
                encoding: 'binary'
            }, function (error, response, body) {
              if (response.statusCode === 200) {
                me = new User({
                    id: id,
                    screen_name: results.screen_name,
                    img: "data:" + response.headers["content-type"] + 
                         ";base64," + 
                         (new Buffer(body, 'binary')).toString('base64'),
                    last_up_date: Date.now()
                });
                me.save(function (err) {
                  analysis();
                });
              }
            });
          }
          else {
            me = docs[0];
            analysis();
          }
        });
      }
  });
});
/****oauth ここまで****/

/**
 * /user/id(idはtwitterのid(整数値))にアクセスが来たときのハンドラ
 * id番のユーザの情報が登録済みなら返す
 */
app.get('/user/:id', function (req, res) {
  var id = req.params.id;
  console.log("/user/id: " + id);
  User.find({id: id}, function (err, docs) {
    if (err) {
      console.log("user not found");
      res.send({});
    }
    else {
      res.send(JSON.stringify(docs[0]));
    }
  });
});

/**
 * /relation/id(idはtwitterのid(整数値))にアクセスが来たときのハンドラ
 * id番のユーザの関係の集合全体を返す
 */
app.get('/relation/:id', function (req, res) {
  var id = req.params.id;
  Relation.find({from: id}, function (err, docs) {
    if (err) {
      res.send([]);
    }
    else {
      res.send(docs);
    }
  });
});

app.get('/between/:id/:oid', function (req, res) {
  var id = req.params.id;
  var oid = req.params.oid;
  Relation.find({from: id, to: oid}, function (err, docs) {
    var r = docs[0] || {from: id, to: oid, score: 0};
    Relation.find({from: oid, to: id}, function (err, docs) {
      var relations = [];
      relations.push(r);
      relations.push(docs[0] || {from: oid, to: id, score: 0});
      res.send(relations);
    });
  });
});

app.get('/friends/:id', function (req, res) {
  console.log("hello");
  var id = req.params.id;
  Relation.find({from: id}, function (err, docs) {
    var relations = docs;
    var counts = relations.length;
    var data = [];
    console.log(relations);
    for (var i = 0; i < relations.length; i ++) {
      var relation = relations[i];
      console.log(relation.to);
      (function (rid) {
        User.find({id: rid}, function (err, docs) {
          var tmp = {id: rid};
          if (docs.length != 0) {
            console.log(docs[0]);
            tmp = {id: rid, img: docs[0].img, screen_name: docs[0].screen_name};
          }
          data.push(tmp);
          console.log(counts + " / " + data.length);
          if (data.length === counts) {
            console.log("send data");
            console.log(data);
            res.send(data);
          }
        });
      })(relation.to);
    }
  });
});

app.get('/img/:id', function (req, res) {
  var id = req.params.id;
  User.find ({id: id}, function (err, docs) {
    console.log(docs);
    if (docs.length === 0) {
      var oa = req.session.oauth;
      oauth.get("http://api.twitter.com/1/users/show.json?user_id=" + id, 
        oa.access_token,
        oa.access_token_secret, 
        function (err, data) {
          var user = JSON.parse(data);
          request({
            uri: 'https://api.twitter.com/1/users/profile_image?screen_name=' + user.screen_name + '&size=normal',
            encoding: 'binary'
          }, function (error, response, body) {
            if (response.statusCode === 200) {
              var u = new User({
                id: user.id,
                screen_name: user.screen_name,
                img: "data:" + response.headers["content-type"] + 
                     ";base64," + 
                     (new Buffer(body, 'binary')).toString('base64')
              });
              u.save();
              res.send({
                id: id,
                screen_name: user.screen_name,
                img: u.img
              });
              
            }
          });
        });
    }
    else {
      var user = docs[0];
      res.send({img: user.img, id: user.id, screen_name: user.screen_name});
    }
  });
});

app.get('signout', function (req, res) {
  delete req.session.oauth;
  delete req.session.user_profile;
  res.redirect('/');
});

app.listen(3000);
