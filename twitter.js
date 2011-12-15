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
    io = require('socket.io').listen(3080),
    store = new (require('connect').session.MemoryStore)(),
    parseCookie = require('connect').utils.parseCookie,
    user_dict = {},
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

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

app.configure(function () {
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.static(__dirname + '/public'));
  app.use(express.session({
    store: store,
    secret: "secret",
    cookie: {httpOnly: false}
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

app.get('/auth/twitter/callback', function (req, res) {
  if (req.session.oauth) {
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
              show_results("mention analysis finished", id);
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
            /*
            for (var i = 0; i < me.following.length; i ++) {
              me.following.pop();
            }*/
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
          
          User.find({id: results.id}, function (err, docs) {
            if (!docs[0]) {
              console.log("new user created");
              request({
                uri: 'https://api.twitter.com/1/users/profile_image?screen_name=' + results.screen_name + '&size=normal',
                encoding: 'binary'
              }, function (error, response, body) {
                if (response.statusCode === 200) {
                  me = new User({
                      id: results.id,
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
  }
});
/****oauth ここまで****/

app.get('signout', function (req, res) {
  delete req.session.oauth;
  delete req.session.user_profile;
  res.redirect('/');
});

app.listen(3000);


function show_results(title, id) {
  console.log("---" + title + "---");
  console.log(user_dict[id]);
  console.log("-------------------------------------");
}



io.sockets.on('connection', function (socket) {
  var sid;
  var session;
  socket.on('cookie', function (data) {
    var cookie = data.cookie;
    sid = parseCookie(cookie)['connect.sid'];
    store.get(sid, function (err, s) {
      session = s; 
      var id = session.user_profile.id;
      User.find({id: id}, function (err, docs) {
        socket.emit("user", JSON.stringify(docs[0]));
      })
    });
  });
  

  socket.on('analysis', function(data) {
    if (!session) {
      var cookie = data.cookie,
          sid = parseCookie(cookie)['connect.sid'];
      store.get(sid, function (err, s) {
        session = s; analysis(data, s);
      });
    }
  });

});
