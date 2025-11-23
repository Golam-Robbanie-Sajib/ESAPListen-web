import pytest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- FIX 1 ---
# Import directly from "database" since it's in the root
from database import Base, Meeting, Event, save_pipeline_results

@pytest.fixture(scope="function")
def mock_db_session():
    """Create a fresh, in-memory SQLite database for each test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # --- FIX 2 ---
    # We need to import the "database" module itself to patch it
    import database
    original_session = database.SessionLocal
    database.SessionLocal = SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Restore the original session factory
        database.SessionLocal = original_session

def test_save_pipeline_results(mock_db_session):
    """
    Tests that a full pipeline result (meeting + events) is saved correctly.
    """
    # 1. Define our mock data
    job_id = "test_job_001"
    raw_transcript = "Hello this is a test."
    final_summary = {"english": "This is a test."}
    extracted_events = {
        "dated_events": [
            {"task": "Test event", "assignee": "Me", "due_date": "2025-11-13"}
        ],
        "notes": [
            {"note_type": "GENERAL_NOTE", "title": "Test Note", "details": "..."}
        ]
    }

    # 2. Run the function we want to test
    save_pipeline_results(
        job_id=job_id,
        raw_transcript=raw_transcript,
        final_summary=final_summary,
        extracted_events=extracted_events,
        user_input="Test input",
        user_input_result={"data": "Test result"}
    )

    # 3. Check (Assert) that the data was saved
    # We use our mock_db_session fixture to query the in-memory database
    session = mock_db_session
    
    # Check if the Meeting was created
    meeting = session.query(Meeting).filter(Meeting.job_id == job_id).first()
    assert meeting is not None
    assert meeting.raw_transcript == raw_transcript
    assert meeting.user_input == "Test input"
    
    # Check if the summary JSON was stored correctly
    saved_summary = json.loads(meeting.final_summary)
    assert saved_summary["english"] == "This is a test."

    # Check if the Events were created and linked
    events = session.query(Event).filter(Event.meeting_id == meeting.id).all()
    assert len(events) == 2  # One dated_event, one note

    # Check the note
    note = next(e for e in events if e.event_type == "notes")
    assert note is not None
    note_data = json.loads(note.event_data)
    assert note_data["title"] == "Test Note"
    
    # Check the dated event
    dated_event = next(e for e in events if e.event_type == "dated_events")
    assert dated_event is not None
    dated_event_data = json.loads(dated_event.event_data)
    assert dated_event_data["task"] == "Test event"