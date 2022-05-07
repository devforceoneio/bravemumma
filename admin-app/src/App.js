import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Form,
  Navbar,
  Row,
  Container,
  Card,
  Table as BTable,
} from "react-bootstrap";
import ReactLoading from "react-loading";
import { useTable } from "react-table";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import moment from "moment";
import CreateUserModal from "./CreateUserModal";
import { db, auth } from "./firebase";
import { Formik, Form as FormikForm } from "formik";
import * as Yup from "yup";
import logo from "./images/bravemumma_logo_with_heart.png";
import "./App.css";

const signInSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
});

const pendingUserSignupRequestsQuery = query(
  collection(db, "userSignupRequests"),
  where("status", "==", "pending"),
);

const SignupSchema = Yup.object().shape({
  firstName: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  lastName: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  email: Yup.string().email("Invalid email").required("Required"),
});

const Table = ({ columns, data }) => {
  const { getTableProps, headerGroups, rows, prepareRow } = useTable({
    columns,
    data,
  });

  return (
    <BTable striped bordered hover size="sm" {...getTableProps()}>
      <thead>
        {headerGroups.map((headerGroup) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column) => (
              <th {...column.getHeaderProps()}>{column.render("Header")}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row, i) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map((cell) => {
                return (
                  <td className="align-middle" {...cell.getCellProps()}>
                    {cell.render("Cell")}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </BTable>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMessage, setErrorMessage] = useState();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showUserModal, setShowUserModal] = useState(true);
  const [userModalMode, usetUserModalMode] = useState("create");

  const createUser = (args) => {
    const functions = getFunctions();
    const createUserCallable = httpsCallable(functions, "createUser");
    return createUserCallable(args);
  };

  const handleApprove = async ({ id, firstName, lastName, emailAddress }) => {
    try {
      setIsSaving(true);
      setErrorMessage("");
      await createUser({
        role: "member",
        requestId: id,
        firstName,
        lastName,
        emailAddress,
      });
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDecline = async ({ id }) => {
    try {
      setIsSaving(true);
      setErrorMessage("");
      await setDoc(
        doc(db, "userSignupRequests", id),
        {
          status: "declined",
        },
        { merge: true },
      );
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        Header: "First Name",
        accessor: "firstName",
      },
      {
        Header: "Last Name",
        accessor: "lastName",
      },
      {
        Header: "Email Address",
        accessor: "emailAddress",
      },
      {
        Header: "Request Date",
        accessor: "requestDate",
        Cell: ({ cell }) => moment(cell.value).format("Do MMMM YY, h:mm:ssa"),
      },
      {
        Header: "Actions",
        accessor: "id",
        Cell: ({ row: { values } }) => (
          <>
            <Button
              size="sm"
              variant="success"
              onClick={() => handleApprove(values)}
              disabled={isSaving}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDecline(values)}
              className="ms-2"
              disabled={isSaving}
            >
              Decline
            </Button>
          </>
        ),
      },
    ],
    [isSaving],
  );

  const getCurrentNonAdminRole = (claims) => {
    if (claims.role === "admin") {
      return "Admin";
    } else if (claims.role === "member") {
      return "Member";
    } else {
      return undefined;
    }
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
  };

  const logout = () => {
    signOut(auth);
  };

  const getErrorMessage = (errorCode) => {
    if (errorCode?.includes("auth/user-disabled")) {
      return "Account has been disabled";
    } else {
      return "Please check your username/password and try again";
    }
  };

  const getSortedRequestsData = useCallback(async (querySnapshot) => {
    const newData = [];
    await querySnapshot.forEach(async (doc) => {
      const docData = await doc.data();
      newData.push({
        id: doc.id,
        firstName: docData.userDetails?.firstName,
        lastName: docData.userDetails?.lastName,
        emailAddress: docData.userDetails?.emailAddress,
        requestDate: docData.createdOn?.seconds * 1000,
        isButtonDisabled: false,
      });
    });
    return newData.sort((a, b) =>
      a.requestDate > b.requestDate
        ? 1
        : a.requestDate < b.requestDate
        ? -1
        : 0,
    );
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        const idTokenResult = await user.getIdTokenResult();
        if (idTokenResult.claims?.admin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
    });
  }, []);

  useEffect(() => {
    const handleUserSignupRequestsChanges = (querySnapshot) => {
      getSortedRequestsData(querySnapshot).then((newData) => {
        setData(newData);
        setIsLoading(false);
      });
    };

    const unsuscribe = onSnapshot(
      pendingUserSignupRequestsQuery,
      handleUserSignupRequestsChanges,
    );
    return () => {
      unsuscribe();
    };
  }, [getSortedRequestsData, pendingUserSignupRequestsQuery]);

  return (
    <div className="App">
      <Navbar expand="md" className="Navbar justify-content-end pe-3">
        {isAuthenticated === true && (
          <Button
            id="logoutButton"
            onClick={logout}
            disabled={isLoading || isSaving}
          >
            Logout
          </Button>
        )}
      </Navbar>
      {isLoading ? (
        <Container className="p-absolute w-100 h-100 fixed-top d-flex align-items-center">
          <ReactLoading type="bars" color="#f26d5f" className="loader" />
        </Container>
      ) : (
        <Container className="mt-5">
          {isAuthenticated === undefined ? (
            <></>
          ) : !isAuthenticated ? (
            <Row>
              <Col className="col-sm-12 my-auto d-flex flex-column justify-content-center">
                <Card className="mx-auto">
                  <Card.Body className="text-center">
                    <Card.Img variant="top" src={logo} />
                    <Card.Title className="align-self-center">
                      <p className="card-title">Admin Login</p>
                    </Card.Title>
                    {errorMessage && (
                      <Alert variant="danger">{errorMessage}</Alert>
                    )}
                    <Formik
                      initialValues={{
                        email: "",
                        password: "",
                      }}
                      validationSchema={signInSchema}
                      onSubmit={async (values) => {
                        const { email, password } = values;
                        setIsLoading(true);
                        try {
                          await signInWithEmailAndPassword(
                            auth,
                            email,
                            password,
                          );
                          setErrorMessage("");
                          let newData = [];
                          const querySnapshot = await getDocs(
                            pendingUserSignupRequestsQuery,
                          );
                          newData = await getSortedRequestsData(querySnapshot);
                          setIsLoading(false);
                          setData(newData);
                        } catch (e) {
                          setErrorMessage(getErrorMessage(e.message));
                        } finally {
                          setIsLoading(false);
                        }
                        return true;
                      }}
                    >
                      {({
                        values,
                        touched,
                        errors,
                        isSubmitting,
                        handleChange,
                        handleBlur,
                      }) => (
                        <FormikForm>
                          <Form.Group
                            className="mb-3 text-start"
                            controlId="formBasicEmail"
                          >
                            <Form.Label>Email address</Form.Label>
                            <Form.Control
                              name="email"
                              type="email"
                              placeholder="Enter email"
                              value={values.email}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className={
                                errors.email && touched.email && "is-invalid"
                              }
                            />
                            {errors.email && touched.email && (
                              <Form.Text className="text-danger ">
                                {errors.email}
                              </Form.Text>
                            )}
                          </Form.Group>
                          <Form.Group
                            className="mb-3 text-start"
                            controlId="formBasicPassword"
                          >
                            <Form.Label>Password</Form.Label>
                            <Form.Control
                              name="password"
                              type="password"
                              placeholder="Password"
                              value={values.password}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className={
                                errors.password &&
                                touched.password &&
                                "is-invalid"
                              }
                            />
                            {errors.password && touched.password && (
                              <Form.Text className="text-danger">
                                {errors.password}
                              </Form.Text>
                            )}
                          </Form.Group>
                          <Button
                            variant="primary"
                            type="submit"
                            disabled={isSubmitting}
                          >
                            Submit
                          </Button>
                        </FormikForm>
                      )}
                    </Formik>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : (
            isAdmin && (
              <>
                <Row fluid="lg">
                  <Col md={3} />
                  <Col md={6}>
                    <h1>Member Requests</h1>
                  </Col>
                  <Col md={3}>
                    <Button
                      className="float-end"
                      onClick={() => setShowUserModal(true)}
                      disabled={isLoading || isSaving}
                    >
                      Create User
                    </Button>
                  </Col>
                </Row>
                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                <Table columns={columns} data={data} />
              </>
            )
          )}
        </Container>
      )}
      <CreateUserModal show={showUserModal} onHide={handleCloseUserModal} />
    </div>
  );
};

export default App;
