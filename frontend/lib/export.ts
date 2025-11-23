/**
 * Export utilities for CSV, PDF, and ICS formats
 */

// CSV Export
export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Build CSV content
  const csvContent = [
    csvHeaders.join(','), // Header row
    ...data.map(row =>
      csvHeaders.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma or newline
        const stringValue = String(value).replace(/"/g, '""');
        return stringValue.includes(',') || stringValue.includes('\n')
          ? `"${stringValue}"`
          : stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// ICS Calendar Export
export function exportToICS(events: any[], filename: string) {
  if (events.length === 0) {
    alert('No events to export');
    return;
  }

  const icsEvents = events.map(event => {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end || event.start);

    return `BEGIN:VEVENT
UID:${event.id}@esaplisten.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${escapeICS(event.title || 'Untitled Event')}
DESCRIPTION:${escapeICS(event.description || '')}
${event.location ? `LOCATION:${escapeICS(event.location)}` : ''}
STATUS:CONFIRMED
END:VEVENT`;
  }).join('\n');

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ESAPListen//Meeting Events//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${icsEvents}
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  downloadBlob(blob, `${filename}.ics`);
}

// PDF Export (using browser print)
export function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Content not found for PDF export');
    return;
  }

  // Open print dialog (user can save as PDF)
  window.print();
}

// Helper: Format date for ICS
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Helper: Escape ICS text
function escapeICS(text: string): string {
  return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
}

// Helper: Download blob
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export meetings to CSV
export function exportMeetingsToCSV(meetings: any[]) {
  const data = meetings.map(m => ({
    'Date Created': new Date(m.created_at).toLocaleDateString(),
    'Job ID': m.job_id,
    'Events Count': m.event_count || 0,
    'Calendar Synced': m.calendar_synced ? 'Yes' : 'No',
    'Has Custom Query': m.has_custom_query ? 'Yes' : 'No',
  }));

  exportToCSV(data, `meetings_${new Date().toISOString().split('T')[0]}`);
}

// Export events to CSV
export function exportEventsToCSV(events: any[]) {
  const data = events.map(e => ({
    'Title': e.title,
    'Date': new Date(e.start).toLocaleDateString(),
    'Time': new Date(e.start).toLocaleTimeString(),
    'Type': e.type,
    'Description': e.description || '',
    'Synced': e.synced ? 'Yes' : 'No',
  }));

  exportToCSV(data, `events_${new Date().toISOString().split('T')[0]}`);
}

// Export notes to CSV
export function exportNotesToCSV(notes: any[]) {
  const data = notes.map(n => ({
    'Title': n.title,
    'Category': n.category,
    'Description': n.description,
    'Date': n.date ? new Date(n.date).toLocaleDateString() : '',
  }));

  exportToCSV(data, `notes_${new Date().toISOString().split('T')[0]}`);
}

// Export single meeting to PDF with all details
export function exportMeetingToPDF(meeting: any) {
  // Create a hidden container for PDF content
  const pdfContainer = document.createElement('div');
  pdfContainer.style.position = 'absolute';
  pdfContainer.style.left = '-9999px';
  pdfContainer.className = 'pdf-export-container';

  // Build HTML content
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4F46E5; padding-bottom: 20px;">
        <h1 style="color: #4F46E5; margin: 0; font-size: 32px;">Meeting Analysis Report</h1>
        <p style="color: #666; margin-top: 10px; font-size: 14px;">
          Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
        </p>
        <p style="color: #666; margin-top: 5px; font-size: 12px;">
          Meeting Date: ${new Date(meeting.created_at).toLocaleDateString()}
        </p>
      </div>

      <!-- Key Takeaways / Summary -->
      ${meeting.key_takeaways || meeting.final_summary ? `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 15px;">
            Key Takeaways
          </h2>
          <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; border-left: 4px solid #4F46E5;">
            ${(() => {
              const summary = meeting.key_takeaways || meeting.final_summary;
              const englishText = summary?.english;
              const arabicText = summary?.arabic || summary?.original_language;

              let content = '';
              if (englishText) {
                content += `<div style="margin-bottom: ${arabicText && arabicText !== englishText ? '20px' : '0'};">
                  <h3 style="font-size: 14px; color: #6B7280; margin-bottom: 10px;">English</h3>
                  <div style="line-height: 1.8; color: #111827;">
                    ${englishText.split('\n').map((line: string) => `<p style="margin-bottom: 10px;">${line}</p>`).join('')}
                  </div>
                </div>`;
              }
              if (arabicText && arabicText !== englishText) {
                content += `<div dir="rtl">
                  <h3 style="font-size: 14px; color: #6B7280; margin-bottom: 10px;">Arabic</h3>
                  <div style="line-height: 1.8; color: #111827;">
                    ${arabicText.split('\n').map((line: string) => `<p style="margin-bottom: 10px;">${line}</p>`).join('')}
                  </div>
                </div>`;
              }
              return content;
            })()}
          </div>
        </div>
      ` : ''}

      <!-- Action Items / Events -->
      ${meeting.dated_events && meeting.dated_events.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 15px;">
            Action Items (${meeting.dated_events.length})
          </h2>
          <div style="display: grid; gap: 15px;">
            ${meeting.dated_events.map((event: any) => {
              const title = event.title || event.task;
              const date = event.formatted_date || event.date || event.due_date;
              const description = event.description || event.context;

              return `
                <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; border-left: 4px solid #10B981;">
                  <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">${title}</h3>
                  <div style="color: #6B7280; font-size: 13px; margin-bottom: 5px;">
                    📅 ${date || 'TBD'}
                  </div>
                  <div style="color: #6B7280; font-size: 13px; margin-bottom: ${description ? '8px' : '0'};">
                    👤 ${event.assignee || 'Unassigned'}
                  </div>
                  ${description ? `<p style="color: #4B5563; font-size: 14px; margin: 0;">${description}</p>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Notes -->
      ${meeting.notes && meeting.notes.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 15px;">
            Notes (${meeting.notes.length})
          </h2>
          <div style="display: grid; gap: 15px;">
            ${meeting.notes.map((note: any) => {
              const category = note.category || note.note_type || 'GENERAL';
              const description = note.description || note.details;
              const borderColor = category === 'BUDGET' || category === 'BUDGET_REQUEST'
                ? '#10B981'
                : category === 'DECISION'
                ? '#3B82F6'
                : '#F59E0B';

              return `
                <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; border-left: 4px solid ${borderColor};">
                  <div style="color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                    ${category.replace(/_/g, ' ')}
                  </div>
                  <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">${note.title}</h3>
                  ${description ? `<p style="color: #4B5563; font-size: 14px; margin: 0;">${description}</p>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Additional Analysis -->
      ${meeting.user_input && meeting.user_input_result ? `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 15px;">
            Additional Analysis
          </h2>
          <div style="background: #EFF6FF; padding: 20px; border-radius: 8px; border-left: 4px solid #3B82F6;">
            <p style="color: #1E40AF; font-weight: 600; margin-bottom: 10px; font-size: 14px;">
              Question: ${meeting.user_input}
            </p>
            <div style="color: #111827; white-space: pre-wrap; line-height: 1.6;">
              ${meeting.user_input_result.content || meeting.user_input_result.description}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Transcript -->
      ${meeting.raw_transcript ? `
        <div style="margin-bottom: 30px; page-break-before: always;">
          <h2 style="color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 15px;">
            Full Transcript
          </h2>
          <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; color: #374151;">
            ${meeting.raw_transcript}
          </div>
        </div>
      ` : ''}

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #E5E7EB; text-align: center; color: #9CA3AF; font-size: 12px;">
        <p>Generated by ESAPListen - AI Meeting Analysis</p>
        <p>Job ID: ${meeting.job_id}</p>
      </div>
    </div>
  `;

  pdfContainer.innerHTML = html;
  document.body.appendChild(pdfContainer);

  // Create print styles
  const style = document.createElement('style');
  style.textContent = `
    @media print {
      body > *:not(.pdf-export-container) {
        display: none !important;
      }
      .pdf-export-container {
        position: static !important;
        left: auto !important;
      }
      @page {
        margin: 1cm;
      }
    }
  `;
  document.head.appendChild(style);

  // Trigger print
  setTimeout(() => {
    window.print();

    // Cleanup after print dialog closes
    setTimeout(() => {
      document.body.removeChild(pdfContainer);
      document.head.removeChild(style);
    }, 100);
  }, 250);
}
