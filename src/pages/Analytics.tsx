import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Hamburger from "@/components/ui/hamburger";
import { format, parse, differenceInMinutes } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Analytics = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateReports = async () => {
    if (!selectedMonth) {
      toast({
        title: "Error",
        description: "Please select a month first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      // Calculate end date (last day of the month)
      const endD = new Date(parseInt(year), parseInt(month), 0);
      const endDate = format(endD, 'yyyy-MM-dd');

      // 1. Fetch Data
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .gte('booking_day', startDate)
        .lte('booking_day', endDate);

      if (bookingsError) throw bookingsError;

      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name');

      if (roomsError) throw roomsError;

      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, name');

      if (coursesError) throw coursesError;

      // Create Maps for easy lookup
      const roomMap = new Map(rooms?.map(r => [r.id, r.name]));
      const courseMap = new Map(courses?.map(c => [c.id, c.name]));

      // Helper to calculate duration in hours
      const calculateDuration = (start: string, end: string) => {
        const s = parse(start, 'HH:mm:ss', new Date());
        const e = parse(end, 'HH:mm:ss', new Date());
        return differenceInMinutes(e, s) / 60;
      };

      // 2. Process Data for Report 1: Raw Booking Data
      const rawData = bookings?.map(booking => {
        const roomName = roomMap.get(booking.room_id) || `Room ${booking.room_id}`;
        const courseName = booking.course_name || (booking.course_id ? courseMap.get(booking.course_id) : 'N/A') || 'N/A';
        const duration = calculateDuration(booking.start_time, booking.end_time);

        return {
          'Date': booking.booking_day,
          'Room': roomName,
          'Course': courseName,
          'Start Time': booking.start_time,
          'End Time': booking.end_time,
          'Duration (Hours)': duration.toFixed(2),
          'Booked By': booking.booked_by,
          'Student Numbers': booking.student_numbers
        };
      });

      // 3. Process Data for Report 2: Room Stats
      const roomStats: Record<string, { bookings: number, hours: number }> = {};
      
      // Initialize all rooms with 0
      rooms?.forEach(room => {
        roomStats[room.name] = { bookings: 0, hours: 0 };
      });

      bookings?.forEach(booking => {
        const roomName = roomMap.get(booking.room_id);
        if (roomName) {
          const duration = calculateDuration(booking.start_time, booking.end_time);
          roomStats[roomName].bookings += 1;
          roomStats[roomName].hours += duration;
        }
      });

      const roomReport = Object.entries(roomStats)
        .map(([room, stats]) => ({
          'Room': room,
          'Total Bookings': stats.bookings,
          'Total Hours': stats.hours.toFixed(2)
        }))
        .sort((a, b) => a.Room.localeCompare(b.Room));

      // 4. Process Data for Report 3: Course Stats
      const courseStats: Record<string, { bookings: number, hours: number }> = {};

      // Initialize known courses with 0 (optional, but good for completeness if we want to show all courses even if not booked)
      courses?.forEach(course => {
        courseStats[course.name] = { bookings: 0, hours: 0 };
      });

      bookings?.forEach(booking => {
        const courseName = booking.course_name || (booking.course_id ? courseMap.get(booking.course_id) : null);
        
        if (courseName) {
          if (!courseStats[courseName]) {
            courseStats[courseName] = { bookings: 0, hours: 0 };
          }
          const duration = calculateDuration(booking.start_time, booking.end_time);
          courseStats[courseName].bookings += 1;
          courseStats[courseName].hours += duration;
        }
      });

      const courseReport = Object.entries(courseStats)
        .map(([course, stats]) => ({
          'Course': course,
          'Total Bookings': stats.bookings,
          'Total Hours': stats.hours.toFixed(2)
        }))
        .sort((a, b) => a.Course.localeCompare(b.Course));

      // 5. Generate Excel File
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(rawData || []);
      XLSX.utils.book_append_sheet(wb, ws1, "Raw Data");

      const ws2 = XLSX.utils.json_to_sheet(roomReport);
      XLSX.utils.book_append_sheet(wb, ws2, "Room Stats");

      const ws3 = XLSX.utils.json_to_sheet(courseReport);
      XLSX.utils.book_append_sheet(wb, ws3, "Course Stats");

      // Auto-width columns (simple approximation)
      const setColWidth = (ws: XLSX.WorkSheet, data: any[]) => {
        if (data.length === 0) return;
        const cols = Object.keys(data[0]).map(key => ({
          wch: Math.max(key.length, ...data.map(row => (row[key] ? row[key].toString().length : 0))) + 2
        }));
        ws['!cols'] = cols;
      };

      setColWidth(ws1, rawData || []);
      setColWidth(ws2, roomReport);
      setColWidth(ws3, courseReport);

      XLSX.writeFile(wb, `Booking_Report_${selectedMonth}.xlsx`);

      toast({
        title: "Success",
        description: "Reports generated and downloaded successfully.",
      });

    } catch (error: any) {
      console.error('Error generating reports:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate reports.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <Hamburger />
          <h1 className="text-2xl font-bold">Analytics & Reports</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Monthly Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="month-select">Select Month</Label>
              <Input
                id="month-select"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full md:w-64"
              />
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will generate an Excel file containing:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground ml-2 space-y-1">
                <li>Raw booking data for the selected month</li>
                <li>Total bookings and hours per room</li>
                <li>Total bookings and hours per course</li>
              </ul>
            </div>

            <Button 
              onClick={handleGenerateReports} 
              disabled={loading}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Download Reports'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Analytics;
