import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Formik, Form as FormikForm } from "formik";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import * as Yup from "yup";

const signUpSchema = Yup.object().shape({
  firstName: Yup.string().required("Required"),
  lastName: Yup.string().required("Required"),
  emailAddress: Yup.string()
    .email("Invalid email address")
    .required("Required"),
  role: Yup.string().required("Required"),
});

const CreateUserModal = ({ show, onHide }) => {
  const [errorMessage, setErrorMessage] = useState();
  const [isSaving, setIsSaving] = useState(false);

  const createUser = (args) => {
    const functions = getFunctions();
    const createUserCallable = httpsCallable(functions, "createUser");
    return createUserCallable(args);
  };

  function delay(delayInms) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(2);
      }, delayInms);
    });
  }

  const handleCreateUser = async ({
    firstName,
    lastName,
    emailAddress,
    role,
  }) => {
    try {
      setIsSaving(true);
      setErrorMessage("");
      await createUser({
        role,
        firstName,
        lastName,
        emailAddress,
      });
      // await delay(5000);
    } catch (e) {
      setErrorMessage(e.message);
      setIsSaving(false);
      return false;
    }
    setIsSaving(false);
    return true;
  };

  const getErrorMessage = (errorCode) => {
    if (errorCode?.includes("auth/user-disabled")) {
      return "Account has been disabled";
    } else {
      return "Please check your username/password and try again";
    }
  };

  return (
    <Modal show={show} onHide={onHide} backdrop="static" keyboard={false}>
      <Modal.Header>
        <Modal.Title>Create User</Modal.Title>
      </Modal.Header>

      <Formik
        initialValues={{
          firstName: "",
          lastName: "",
          emailAddress: "",
          role: "member",
        }}
        validationSchema={signUpSchema}
        onSubmit={async (values) => {
          const { firstName, lastName, emailAddress, role } = values;
          await handleCreateUser({
            firstName,
            lastName,
            emailAddress,
            role,
          });
          return true;
        }}
      >
        {({
          values,
          touched,
          errors,
          dirty,
          isValid,
          handleChange,
          handleBlur,
          handleReset,
        }) => (
          <>
            <Modal.Body>
              {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
              <FormikForm>
                <Form.Group
                  className="mb-3 text-start"
                  controlId="formBasicPassword"
                >
                  <Form.Label>First Name</Form.Label>
                  <Form.Control
                    name="firstName"
                    type="text"
                    placeholder="Enter first name"
                    value={values.firstName}
                    disabled={isSaving}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={
                      errors.firstName && touched.firstName && "is-invalid"
                    }
                  />
                  {errors.firstName && touched.firstName && (
                    <Form.Text className="text-danger">
                      {errors.firstName}
                    </Form.Text>
                  )}
                </Form.Group>
                <Form.Group
                  className="mb-3 text-start"
                  controlId="formBasicPassword"
                >
                  <Form.Label>Last Name</Form.Label>
                  <Form.Control
                    name="lastName"
                    type="text"
                    placeholder="Enter last name"
                    value={values.lastName}
                    disabled={isSaving}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={
                      errors.lastName && touched.lastName && "is-invalid"
                    }
                  />
                  {errors.lastName && touched.lastName && (
                    <Form.Text className="text-danger">
                      {errors.lastName}
                    </Form.Text>
                  )}
                </Form.Group>
                <Form.Group
                  className="mb-3 text-start"
                  controlId="formBasicEmailAddress"
                >
                  <Form.Label>Email Address</Form.Label>
                  <Form.Control
                    name="emailAddress"
                    type="email"
                    placeholder="Enter email address"
                    value={values.emailAddress}
                    disabled={isSaving}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={
                      errors.emailAddress &&
                      touched.emailAddress &&
                      "is-invalid"
                    }
                  />
                  {errors.emailAddress && touched.emailAddress && (
                    <Form.Text className="text-danger ">
                      {errors.emailAddress}
                    </Form.Text>
                  )}
                </Form.Group>
                <Form.Group
                  className="mb-3 text-start"
                  controlId="formBasicRole"
                >
                  <Form.Label>Role</Form.Label>
                  <Form.Check
                    name="role"
                    value="member"
                    type="radio"
                    aria-label="member"
                    label="Member"
                    disabled={isSaving}
                    onChange={handleChange}
                    checked={values.role === "member"}
                  />
                  <Form.Check
                    name="role"
                    value="admin"
                    type="radio"
                    aria-label="admin"
                    label="Admin"
                    disabled={isSaving}
                    onChange={handleChange}
                    checked={values.role === "admin"}
                  />
                </Form.Group>
              </FormikForm>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => {
                  handleReset();
                  onHide();
                }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={!(dirty && isValid) || isSaving}
                onClick={async () => {
                  const result = await handleCreateUser(values);
                  if (result) {
                    handleReset();
                    onHide();
                  }
                }}
              >
                {isSaving ? "Creating..." : "Create"}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Formik>
    </Modal>
  );
};

export default CreateUserModal;
