import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- Initialize Logger ---
logger = logging.getLogger(__name__)


class GoogleCalendarOAuth:
    """
    OAuth-based Google Calendar client for per-user calendar access.
    Handles token refresh automatically.
    """

    def __init__(self, access_token: str, refresh_token: str, token_expiry: datetime):
        """
        Initialize with user's OAuth tokens.

        Args:
            access_token: User's access token
            refresh_token: User's refresh token
            token_expiry: Token expiration datetime
        """
        logger.info("📅 Initializing OAuth Google Calendar client...")

        # Create credentials object
        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
            scopes=["https://www.googleapis.com/auth/calendar.events"]
        )

        # Set expiry
        if token_expiry:
            self.credentials.expiry = token_expiry

        # Refresh token if expired
        if self.credentials.expired and self.credentials.refresh_token:
            try:
                logger.info("   Token expired, refreshing...")
                self.credentials.refresh(Request())
                logger.info("   ✓ Token refreshed")
            except Exception as e:
                logger.error(f"   ❌ Token refresh failed: {e}")
                raise

        # Build service
        try:
            self.service = build('calendar', 'v3', credentials=self.credentials)
            logger.info("   ✓ OAuth Calendar API ready")
        except Exception as e:
            logger.error(f"❌ Failed to build Calendar service: {e}", exc_info=True)
            raise

    def get_updated_tokens(self) -> Dict:
        """
        Get updated tokens after refresh.
        Call this after operations to get fresh tokens to store.
        """
        return {
            "access_token": self.credentials.token,
            "refresh_token": self.credentials.refresh_token,
            "expiry": self.credentials.expiry
        }

    def create_events_from_extraction(self, extracted_events: Dict) -> List[str]:
        """
        Create calendar events from extracted meeting data.
        Returns list of event HTML links.
        """
        logger.info("📅 Creating calendar events from extraction...")
        event_links = []

        # Process dated_events
        for event in extracted_events.get('dated_events', []):
            if link := self._create_task_event(event):
                event_links.append(link)

        logger.info(f"   ✓ Successfully created {len(event_links)} calendar events")
        return event_links

    def _create_task_event(self, event_data: Dict) -> Optional[str]:
        """
        Create a calendar event for a task/action item.
        """
        try:
            task = event_data.get('task', 'Untitled Task')
            due_date = event_data.get('due_date', 'TBD')

            # Handle missing or TBD dates
            if not due_date or 'TBD' in str(due_date).upper():
                due_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')

            # Build description
            description_parts = [
                f"Task: {task}",
                f"Assignee: {event_data.get('assignee', 'Unassigned')}",
                f"Context: {event_data.get('context', 'N/A')}"
            ]
            description = "\n".join(description_parts)

            # Create event body
            event_body = {
                'summary': f"🔴 {task[:90]}",
                'description': description,
                'start': {'date': due_date},
                'end': {'date': due_date},
                'colorId': '11',  # Red for tasks
            }

            # Insert event
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event_body
            ).execute()

            event_link = created_event.get('htmlLink')
            logger.info(f"      ✓ Created task: '{task[:50]}' (Due: {due_date})")
            return event_link

        except HttpError as e:
            logger.error(f"      ❌ HTTP error creating event: {e}")
            return None
        except Exception as e:
            logger.error(f"      ❌ Error creating event: {e}", exc_info=True)
            return None


class GoogleCalendarPoster:
    """
    Posts extracted events to Google Calendar.
    """
    
    def __init__(self, service_account_file: str, target_calendar_id: str):
        logger.info("📅 Initializing Google Calendar client...")
        
        # Ensure the service account file exists.
        if not os.path.exists(service_account_file):
            raise FileNotFoundError(f"Service account file not found: {service_account_file}")
        
        try:
            SCOPES = ['https://www.googleapis.com/auth/calendar'] # Full access to Calendar.
            credentials = service_account.Credentials.from_service_account_file(
                service_account_file, scopes=SCOPES
            )
            self.service = build('calendar', 'v3', credentials=credentials)
            self.calendar_id = target_calendar_id
            logger.info(f"   ✓ Target calendar set to: {self.calendar_id}")
            
            # Immediately test the connection to fail fast.
            self._test_connection()
            
            logger.info("   ✓ Calendar API ready.")
        
        except Exception as e:
            logger.error(f"❌ Failed to initialize Calendar API.", exc_info=True)
            raise
    
    def _test_connection(self):
        """Tests if the service account can access the target calendar."""
        try:
            logger.info("   Testing connection to calendar...")
            calendar = self.service.calendars().get(calendarId=self.calendar_id).execute()
            logger.info(f"   ✓ Successfully connected to calendar: '{calendar.get('summary', 'Unknown')}'")
        except HttpError as e:
            if e.resp.status == 404:
                logger.error(f"   ❌ FATAL: Calendar not found. The ID '{self.calendar_id}' does not exist.")
            elif e.resp.status == 403:
                logger.error(f"   ❌ FATAL: Permission denied for calendar '{self.calendar_id}'.")
                logger.error("   💡 SOLUTION: Go to your Google Calendar settings and share it with your service account email, giving it 'Make changes to events' permission.")
            else:
                logger.error(f"   ❌ An unknown Google API error occurred during connection test: {e}")
            raise

    def post_events(self, extracted_events: Dict) -> List[str]:

        # Posts action items and deadlines to the Google Calendar.
        logger.info(f"📅 Posting events to calendar: {self.calendar_id}")
        event_links = []
        
        #Create calendar events for action items and deadlines
        for item in extracted_events.get('action_items', []):
            if link := self._create_action_item_event(item):
                event_links.append(link)

        for deadline in extracted_events.get('deadlines', []):
            if link := self._create_deadline_event(deadline):
                event_links.append(link)
        
        logger.info(f"   ✓ Successfully posted {len(event_links)} events.")
        if event_links:
            logger.info("📋 Clickable Event Links:")
            for i, link in enumerate(event_links, 1):
                logger.info(f"   {i}. {link}")
        return event_links

    def _create_action_item_event(self, item: Dict) -> Optional[str]:

        # Creates a calendar event for a single action item.
        try:
            task = item.get('task', 'Untitled Task')
            due_date = item.get('due_date', 'TBD')
            if due_date is None or 'TBD' in str(due_date).upper():
                due_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
            
            description = f"<b>Task:</b> {task}\n<b>Assignee:</b> {item.get('assignee', 'Unassigned')}\n<b>Context:</b> {item.get('context', 'N/A')}"
            event_body = {
                'summary': f"🔴 ACTION: {task[:80]}",
                'description': description,
                'start': {'date': due_date},
                'end': {'date': due_date},
                'colorId': '11',  # Red
            }
            created_event = self.service.events().insert(calendarId=self.calendar_id, body=event_body).execute()
            logger.info(f"      ✓ Created Action Item: '{task[:50]}...' (Due: {due_date})")
            return created_event.get('htmlLink')
        except Exception as e:
            logger.error(f"      ❌ Error creating action item event: {item.get('task')}", exc_info=True)
            return None
            
    def _create_deadline_event(self, deadline: Dict) -> Optional[str]:

        # Creates a calendar event for a single deadline.
        try:
            item_due = deadline.get('item', 'Untitled Deadline')
            date = deadline.get('date', 'TBD')
            if date is None or 'TBD' in str(date).upper():
                logger.warning(f"      - Skipping deadline with no date: '{item_due}'")
                return None
            
            description = f"<b>Item Due:</b> {item_due}\n<b>Owner:</b> {deadline.get('owner', 'Unassigned')}"
            event_body = {
                'summary': f"⏰ DEADLINE: {item_due[:80]}",
                'description': description,
                'start': {'date': date},
                'end': {'date': date},
                'colorId': '9',  # Blue
            }
            created_event = self.service.events().insert(calendarId=self.calendar_id, body=event_body).execute()
            logger.info(f"      ✓ Created Deadline: '{item_due[:50]}...' (Date: {date})")
            return created_event.get('htmlLink')
        except Exception as e:
            logger.error(f"      ❌ Error creating deadline event: {deadline.get('item')}", exc_info=True)
            return None

def create_calendar_poster() -> Optional[GoogleCalendarPoster]:

    # Factory function to create a GoogleCalendarPoster if environment variables are set.
    service_account_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    target_calendar_id = os.getenv("GOOGLE_CALENDAR_ID")
    
    if not target_calendar_id:
        logger.warning("⚠️ GOOGLE_CALENDAR_ID not set in .env file. Calendar posting will be disabled.")
        return None
    
    try:
        return GoogleCalendarPoster(
            service_account_file=service_account_file,
            target_calendar_id=target_calendar_id
        )
    except Exception:
        logger.error("❌ Calendar poster failed to initialize. Check previous logs for connection test errors.")
        return None

calendar_poster = create_calendar_poster()