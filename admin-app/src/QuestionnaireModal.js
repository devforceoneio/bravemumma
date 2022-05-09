import { Button, Modal } from "react-bootstrap";

const QuestionnaireModal = ({ show, onHide, data }) => {
  return (
    <Modal show={show} onHide={onHide} backdrop="static">
      <Modal.Header>
        <Modal.Title>Questionnaire</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {data?.map((element) => (
          <>
            <p className="mb-1">
              <b>Question:</b> {element.question}
            </p>
            <p className="mb-3">
              <b>Answer:</b> {element.answer}
            </p>
          </>
        ))}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="primary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default QuestionnaireModal;
