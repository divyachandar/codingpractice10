const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();
const convertDbObject = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};

//API 1
//login of the user

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isMatchedPassword = await bcrypt.compare(password, dbUser.password);
    if (isMatchedPassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication with Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split("")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 2
//Returns a list of all states in the state table
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `select * from state`;
  const getStatesQueryResponse = await db.all(getStatesQuery);
  response.send(
    getStatesQueryResponse.map((eachState) => convertDbObject(eachState))
  );
});

//API 3
//Returns a state based on the state ID

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `select * from state where state_id=${stateId};`;
  const getStateDetailsQueryResponse = await db.get(getStateDetailsQuery);
  response.send(convertDbObject(getStateDetailsQueryResponse));
});

//API 4
//Create a district in the district table, district_id is auto-incremented

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) 
    values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const createDistrictQueryResponse = await db.run(createDistrictQuery);
  const districtId = createDistrictQueryResponse.lastId;
  response.send("District Successfully Added");
});

//API 5
//Returns a district based on the district ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetailsQuery = `select * from district where district_id=${districtId};`;
    const getDistrictDetailsQueryResponse = await db.get(
      getDistrictDetailsQuery
    );
    response.send(convertDbObject(getDistrictDetailsQueryResponse));
  }
);

//API 6
//Deletes a district from the district table based on the district ID

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
//Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictDetailsQuery = `update district set 
district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths};`;
    await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

//API 8
//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatisticsQuery = `select sum(cases),sum(cured),sum(active),sum(deaths)
from district where state_id=${stateId};`;
    const getStatisticsQueryResponse = await db.get(getStatisticsQuery);
    console.log(getStatisticsQueryResponse);
    response.send({
      totalCases: getStatisticsQueryResponse["sum(cases)"],
      totalCured: getStatisticsQueryResponse["sum(cured)"],
      totalActive: getStatisticsQueryResponse["sum(active)"],
      totalDeaths: getStatisticsQueryResponse["sum(deaths)"],
    });
  }
);

module.exports = app;
