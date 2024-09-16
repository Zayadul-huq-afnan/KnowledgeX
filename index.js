//jshint esversion:6
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mysql = require("mysql");
const { error } = require("console");
const session = require("express-session");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const passport = require("passport");
const passportLocal = require("passport-local");
const multer = require("multer");
const path = require("path");
const e = require("express");
const { constrainedMemory } = require("process");

const app = express();

app.use(express.static("public"));
//app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: "our little secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(passport.authenticate("session"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public", "upload"));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const userName = req.user.id;
    const timestamp = Date.now();
    cb(null, `${userName}_${timestamp}${ext}`);
  },
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
  host: "localhost", // Your MySQL host
  user: "root", // Your MySQL username
  password: "", // Your MySQL password
  database: process.env.DATA_BASE, // Your database name
});

passport.use(
  new passportLocal(
    {
      usernameField: "email", // Look for 'email' in the request body
      passwordField: "password", // Look for 'password' in the request body
    },
    async (username, password, done) => {
      const query = `
                    SELECT * FROM user_details WHERE email = ?
                    UNION
                    SELECT * FROM instructor_detail WHERE email = ?;
                    `;

      connection.query(query, [username, username], async (err, results) => {
        if (err) return done(err);

        if (results.length === 0) {
          return done(null, false, { message: "Incorrect username." });
        }

        const user = results[0];

        // Compare the provided password with the hashed password in the database
        const match = await bcrypt.compare(password, user.password);
        if (!match && user.password != password) {
          return done(null, false, { message: "Incorrect password." });
        }

        // User authenticated successfully
        return done(null, user);
      });
    }
  )
);

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.email,
    });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

//get rooutes

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/instructor-login", function (req, res) {
  //console.log(req.user.id);
  if (req.isAuthenticated()) {
    const query = "SELECT 1 FROM instructor_detail WHERE email = ?";
    //console.log(req.user.id);
    connection.query(query, [req.user.id], (error, result) => {
      if (error) {
        throw error;
      }

      if (result.length > 0) {
        const query = "SELECT course_code, course_name FROM course_list WHERE instructor_email = ?";
        connection.query(query, [req.user.id], (error, lists) => {
          if (error) throw error;

          // Map the SQL results to an array of pairs
          const courses = lists.map((row) => {
            return {
              code: row.course_code,
              name: row.course_name,
            };
          });
          //console.log(courses);
          res.render("instructor_view", { courses: courses });
        });
        // const courses = [
        //   { code: "CS101", name: "Introduction to Computer Science" },
        //   { code: "MATH201", name: "Calculus II" },
        //   { code: "PHY102", name: "General Physics" },
        // ];

        // res.render("instructor_view", { courses: courses });
      } else {
        res.redirect("/first_page");
      }
    });
  } else {
    res.redirect("/first_page");
  }
  //console.log(req.user);
  //res.send(req.b);
});

app.get("/first_page", function (req, res) {
  if (req.isAuthenticated()) {
    //res.render("secrets");
    // const courses = [
    //   { code: "CS101", name: "Introduction to Computer Science" },
    //   { code: "MATH201", name: "Calculus II" },
    //   { code: "PHY102", name: "General Physics" },
    //   { code: "ENG101", name: "English Literature" },
    //   { code: "CHEM101", name: "Chemistry Basics" },
    //   { code: "BIO202", name: "Human Biology" },
    //   { code: "HIST301", name: "World History" },
    // ];
    // res.render("first_page", { courses: courses });

    const query = "SELECT course_code, course_name FROM course_list";
    connection.query(query, (error, results) => {
      if (error) throw error;

      // Map the SQL results to an array of pairs
      const courses = results.map((row) => {
        return {
          code: row.course_code,
          name: row.course_name,
        };
      });
      //console.log(courses);
      res.render("first_page", { courses: courses });
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/add-course", function (req, res) {
  res.render("add_course");
});

app.get("/profile", function (req, res) {
  if (req.isAuthenticated()) {
    const query =
      "SELECT email, linkedin, github, twitter, codeforces, name , path FROM profile WHERE email = ?";
    connection.query(query, [req.user.id], (error, results) => {
      if (error) throw error;
      //console.log(results[0]);
      res.render("profile2", {
        twitter: results[0].twitter,
        linkedin: results[0].linkedin,
        github: results[0].github,
        codeforces: results[0].github,
        name: results[0].name,
        path: results[0].path,
      });
    });
    //res.render("profile", { user: req.user });
  } else {
    res.redirect("/");
  }
});

app.get("/upload", function (req, res) {
  res.render("upload");
});

app.get("/test", function (req, res) {
  const query = "SELECT path FROM demo WHERE email = ?";
  connection.query(query, [req.user.id], (error, results) => {
    if (error) {
      console.error("Error querying database:", error);
      return;
    }

    if (results.length > 0) {
      const filePath = results[0].path;
      //console.log(filePath);
      res.render("test", { path: filePath });
    } else {
      console.log("No user found with the given email.");
    }
  });
});

//app.get()

app.get("/enroll_reuqest_list", function(req, res){
  const course_code = req.query.course_code;
  const username = req.query.username;
  //console.log(course_code);
  //console.log(username);

  const query  = "DELETE FROM enroll_request WHERE requested_user = ? AND course_code = ?";

    connection.query(query, [username, course_code], (error, results) => {
      //console.log("deleted");

      if(error) throw error;
      //res.send("Deleted");

      const query2 = "SELECT requested_user FROM enroll_request WHERE course_code = ?";

      connection.query(query2, [course_code], (err, lists) =>{
        if(err) throw err;
        const request_list = lists.map((row) => {
          return {
            name: row.requested_user,
          };
        });
  
          res.render("enroll_request", {request_list : request_list , course_code : course_code});
      })
      });

})

app.get("/reject/:requested_user/:course_code", function(req, res){
  const user_name = req.params.requested_user;
  const course_code = req.params.course_code;
  res.redirect(`/enroll_reuqest_list?username=${user_name}&course_code=${course_code}`);
})

app.get("/chapter_list" , function(req, res){

    const course_code = req.query.course_code;
    const query = "SELECT course_code, chapter_name from course_contents WHERE course_code = ?"

    connection.query(query, [course_code] , (error, results) =>{
      if(error)  throw error
  
      const chapter_list = results.map((row) => {
        return {
          chapter_name: row.chapter_name,
        };
      });
  
        res.render("chapter_list", {chapter_list : chapter_list, course_code : course_code});
  
    })

})

app.get("/chapter_contents/:course_code/:chapter_name", function(req, res){
   
   const course_code = req.params.course_code;
   const chapter_name = req.params.chapter_name;
   //console.log(req.params);
   //console.log(course_code);
   //console.log(chapter_name);
   
   const query = "SELECT video_path FROM course_contents WHERE course_code = ? AND chapter_name = ?";

   connection.query(query, [course_code, chapter_name], (error, results) =>{
    if(error)throw error;

    if(results.length == 0){
      //console.log("null");
      res.render("chapter_detail", {chapter_name: chapter_name, video_path : "@" , course_code :course_code });
    }
    else{
      //console.log(results[0].video_path);
      const file_path = String(results[0].video_path);
      //console.log("video");
      //console.log("y");
      //console.log(file_path);
      res.render("chapter_detail", {chapter_name: chapter_name, video_path: file_path , course_code :course_code });
    }
   })
   
})

app.get("/chapter_contents", function(req, res){
  const course_code = req.query.course_code;
  const chapter_name = req.query.chapter_name;
  const file_path = req.query.file_path;
  console.log(file_path);
  res.render("chapter_detail", {chapter_name: chapter_name, video_path : file_path , course_code :course_code });
})

app.get("/accept/:requested_user/:course_code", function(req, res){

  const user_name = req.params.requested_user;
  const course_code = req.params.course_code;
  //console.log(req.params.requested_user);
  //console.log(req.params.course_code);

  const query = "SELECT * FROM enrolled_users WHERE username = ? AND course_code = ?";
  
  connection.query(query, [user_name, course_code], (error, results) => {
    if (error) {
      console.error('Error checking existing request:', error);
      return res.status(500).send('Internal Server Error');
    }
    
    if (results.length === 0) {
      
      const query2 = "INSERT INTO enrolled_users (username, course_code) VALUES (?, ?)";

      connection.query(query2, [user_name, course_code], (err, results2) => {
        if (err) {
          throw err;
        }

        res.redirect(`/enroll_reuqest_list?username=${user_name}&course_code=${course_code}`);
      });
    } else {
      // Request already exists
      res.send("Request already exists");
    }
  });
})

// app.get("/test", function(req, res){
//   res.render("test");
// })
//post routes

app.post("/register", function (req, res) {
  let email = req.body.email;
  let password = req.body.password;
  let name = req.body.name;

  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      res.send("Error hashing password:", err);
      return;
    }

    // Save hash to the database instead of the plain text password
    const query = "INSERT INTO user_details (email, password, name) VALUES (?, ?, ?)";
    const default_path = "upload/default.jpg";
    connection.query(query, [email, hash, name], (error, results, fields) => {
      if (error) throw error;

      //res.send("In");
      const query = "INSERT INTO profile (email, name, path) VALUES (?, ? , ?)";
      connection.query(query,[email, name, default_path],(err, vals, fiel) => {
          if (err) throw err;
          res.redirect("/first_page");
        }
      );
    });
  });
});

app.post("/login",passport.authenticate("local", { failureRedirect: "/login" }),function (req, res) {
    res.redirect("/first_page");
  }
);

app.post("/add-course", function (req, res) {
  const course_code = req.body.courseCode;
  const course_name = req.body.courseName;

  const query = "SELECT name FROM instructor_detail WHERE email = ?";

  connection.query(query, [req.user.id], (error, name, fields) => {
    if (error) {
      throw error;
    }
    //console.log(name[0].name);

    const query =
      "INSERT INTO course_list (course_code, course_name, instructor_email, instructor_name) VALUES (?, ? , ?, ?)";
    connection.query(
      query,
      [course_code, course_name, req.user.id, name[0].name],
      (error, results, fields) => {
        if (error) throw error;
      }
    );

    res.redirect("/instructor-login");
  });
});

app.post("/upload", upload.single("profilePicture"), (req, res) => {
  const userId = req.user.id;
  //console.log(req.file);
  const filePath = path.join("upload", req.file.filename).replace(/\\/g, "/"); // Relative path

  // Update the user's profile with the new profile picture path
  const query = "UPDATE profile SET path = ? WHERE email = ?";
  connection.query(query, [filePath, userId], (error, results) => {
    if (error) {
      console.error("Error updating profile picture:", error);
      return res.status(500).send("Error updating profile picture");
    }

    res.redirect("/profile");
  });
});

app.post("/upload_video/:course_code/:chapter_name", upload.single("videoFile"), (req, res) => {

  const course_code = req.params.course_code;
  const chapter_name = req.params.chapter_name;

  //console.log(course_code);
  //console.log(chapter_name);
  const userId = req.user.id;
  //console.log(req.file);
  const filePath = path.join("upload", req.file.filename).replace(/\\/g, "/"); // Relative path
  //console.log(filePath);
  // Update the user's profile with the new profile picture path
  const query = "UPDATE  course_contents SET video_path = ? WHERE course_code = ? AND chapter_name = ?";
  connection.query(query, [filePath, course_code, chapter_name], (error, results) => {
    if (error) {
      console.error("Error updating profile picture:", error);
      return res.status(500).send("Error updating profile picture");
    }
    //console.log(results);

    res.redirect(`/chapter_contents?course_code=${course_code}&chapter_name=${chapter_name}&file_path=${filePath}`);
    //res.send("Suffessfully addded video!");
    //res.redirect("/profile");
  });
});

app.post("/update-contact", function (req, res) {
  twitter = req.body.twitter;
  github = req.body.github;
  linkedin = req.body.linkedin;
  codeforces = req.body.codeforces;

  const query =
    "UPDATE profile SET twitter = ?, linkedin = ?, github = ?, codeforces = ? WHERE email = ? ";

  connection.query(
    query,
    [twitter, linkedin, github, codeforces, req.user.id],
    (error, results) => {
      if (error) throw error;

      res.redirect("/profile");
    }
  );
});


app.post("/enroll", function (req, res) {
  const course_code = req.body.courseCode;
  const user_name = req.user.id;
  //console.log("id: ", user_name);

  const checkQuery = "SELECT * FROM enroll_request WHERE requested_user = ? AND course_code = ?";
  
  connection.query(checkQuery, [user_name, course_code], (error, results) => {
    if (error) {
      console.error('Error checking existing request:', error);
      return res.status(500).send('Internal Server Error');
    }
    
    if (results.length === 0) {

      const insertQuery = "INSERT INTO enroll_request (course_code, requested_user) VALUES (?, ?)";

      connection.query(insertQuery, [course_code, user_name], (err, results2) => {
        if (err) {
          console.error('Error inserting request:', err);
          //console.log(user_name);
          return res.status(500).send('Internal Server Error');
        }

        res.send("Request sent");
      });
    } else {
      // Request already exists
      res.send("Request already exists");
    }
  });

  // Debugging logs
  //console.log("Course Code:", course_code);
  //console.log("User Name:", user_name);
});

app.post("/course_details", function(req, res){
  //console.log(req.body.courseCode);
  const course_code = req.body.courseCode;
  res.render("course_details", {course_code: course_code});
})

app.post("/enroll_requests", function(req, res){
    const course_code = req.body.courseCode;
    //console.log("sss: ", course_code);

    const query = "SELECT requested_user FROM enroll_request WHERE course_code = ?";

    connection.query(query, [course_code], (error, results) => {

      if(error) throw error;

      const request_list = results.map((row) => {
        return {
          name: row.requested_user,
        };
      });

        res.render("enroll_request", {request_list : request_list , course_code : course_code});
      });
})

app.post("/course_contents", function(req, res){
  const course_code = req.body.courseCode;
  res.redirect(`/chapter_list?course_code=${course_code}`);

})

app.post("/add_chapter/:course_code" , function(req, res){

  const course_code = req.params.course_code;
  const chapter_name = req.body.chapter_name;

  const query = "INSERT INTO course_contents (course_code, chapter_name) VALUES (?, ?)";

  connection.query(query, [course_code, chapter_name], (error, result) =>{
    if(error) throw error

    res.redirect(`/chapter_list?course_code=${course_code}`);
  })
  //console.log(req.params.course_code);
  //console.log(req.body);
})

app.listen(3000, function () {
  console.log("App started on port 3000");
});
