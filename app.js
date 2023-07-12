const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializationAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server is running at http://localhost:3001 ");
    });
  } catch (err) {
    console.log(err.message);
    process.exit(1);
  }
};

initializationAndServer();

// authentication
const authenticationToken = (request, response, next) => {
  let jwtToken;
  let authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (err, payload) => {
      if (err) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//api 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  let passwordHashed = await bcrypt.hash(password, 10);
  let findUserExistsOrNot = `
  SELECT 
    * 
  FROM 
    user 
  WHERE 
    username='${username}';`;
  const dbUser = await db.get(findUserExistsOrNot);

  if (dbUser === undefined) {
    let createUserQuery = `
    INSERT INTO 
        user(username, password, name, gender)
    VALUES('${username}', 
            '${passwordHashed}', 
            '${name}', 
            '${gender}'
            );`;
    console.log(password.length);
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const dbNewUser = await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// api 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectFindQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectFindQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password);
    if (isPasswordCorrect === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertUser = (item) => {
  return {
    username: item.username,
    tweet: item.tweet,
    dateTime: item.dateTime,
  };
};
// api 3
app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    const {
      search_q = "",
      order_by = "user_id",
      order = "ASC",
      limit = 4,
      offset = 0,
    } = request.query;
    const sqlQueryToFind = `
    SELECT username,tweet,date_time AS dateTime FROM tweet 
    INNER JOIN follower ON tweet.user_id=follower.following_user_id
    INNER JOIN user ON user.user_id=tweet.user_id
    ORDER BY '${order_by}' '${order}'
    LIMIT '${limit}' OFFSET '${offset}'; `;
    const dbUser = await db.all(sqlQueryToFind);
    response.send(dbUser.map((each) => convertUser(each)));
  }
);

// api 4
app.get("/user/following/", async (request, response) => {
  const followerFind = `
    SELECT name FROM user INNER JOIN follower ON user.user_id=follower.following_user_id;`;
  const dbUser = await db.all(followerFind);
  response.send(dbUser);
});

// api 5
app.get("/user/followers/", async (request, response) => {
  const followerFind = `
    SELECT name FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id;`;
  const dbUser = await db.all(followerFind);
  response.send(dbUser);
});

// api 6
app.get("/tweets/:tweetId", authenticationToken, async (request, response) => {
  const { tweetId } = request.params;
  const gettingQuery = `
    SELECT 
        tweet,
        COUNT(like.tweet_id) AS likes,
        COUNT(reply) AS replies,
        tweet.date_time AS tweet_time
    FROM tweet 
        INNER JOIN reply ON tweet.tweet_id=reply.tweet_id
        INNER JOIN like ON tweet.tweet_id=like.tweet_id
    WHERE tweet.tweet_id='${tweetId}';`;
  const tweetDetails = await db.all(gettingQuery);
  if (tweetDetails === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(tweetDetails);
  }
});

// api 7

module.exports = app;
