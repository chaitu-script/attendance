"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Image from "next/image";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Spinner,
  DateRangePicker,
  Select,
  SelectItem,
} from "@nextui-org/react";
import { today, getLocalTimeZone } from "@internationalized/date";
import { departmentOptions } from "../utils/department";
import * as XLSX from "xlsx";

const AttendanceDisplay = () => {
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [viewType, setViewType] = useState("individual");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: today(getLocalTimeZone()).subtract({ weeks: 2 }),
    end: today(getLocalTimeZone()),
  });

  const fetchClasses = async () => {
    if (userProfile?.role === "admin" || userProfile?.role === "superadmin") {
      try {
        const response = await axios.get(`/api/classes?department=${selectedDepartment}`);
        setClasses(response.data);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    }
  };

  useEffect(() => {
    const storedProfile = sessionStorage.getItem("userProfile");
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      if(profile?.classes) {
        setSelectedClass(profile?.classes)}
      setUserProfile(profile);
      if (profile.role === "admin") {
        setSelectedDepartment(profile.department);
      }
    }
  }, []);

  const handleSelectChange = (value) => {
    setSelectedDepartment(value);
  };

  useEffect(() => {
    if (userProfile?.role === "admin" || userProfile?.role === "superadmin") {
      fetchClasses();
    }
  }, [selectedDepartment, userProfile]);

  const fetchAttendance = async () => {
    setLoading(true);
    setError(null);
  
    try {
      let url = "/api/attendance-reports?";
      
      if (userProfile.role === "student") {
        url += `studentId=${userProfile._id}`;
      } else if (userProfile.role === "faculty") {
        if (userProfile.classes.includes(selectedClass) && viewType=="cumulative") {
          url += `classId=${selectedClass}`;
        } else {
          url += `subjectId=${selectedSubject}`;
        }
      } else if (userProfile.role === "admin" || userProfile.role === "superadmin") {
        url += `classId=${selectedClass}`;
        if (viewType === "individual" && selectedSubject) {
          url += `&subjectId=${selectedSubject}`;
        }
      }
  
      url += `&startDate=${dateRange.start.toString()}&endDate=${dateRange.end.toString()}`;
  
      const response = await axios.get(url);
      setAttendanceData(response.data);
    } catch (err) {
      setError("Failed to fetch attendance data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  

  useEffect(() => {
    if (userProfile) {
      if (
        userProfile.role === "student" ||
        (userProfile.role === "faculty" && (selectedSubject || userProfile.classes.includes(selectedClass))) ||
        ((userProfile.role === "admin" || userProfile.role === "superadmin") &&
          selectedClass &&
          (viewType === "cumulative" || (viewType === "individual" && selectedSubject)))
      ) {
        fetchAttendance();
      }
    }
  }, [userProfile, selectedSubject, selectedClass, viewType, dateRange]);
  const generateExcelReport = () => {
    if (!attendanceData) return;
  
    let wsData = [];
  
    const sortByRollNumber = (a, b) => parseInt(a.rollNumber || a.student.rollNumber, 10) - parseInt(b.rollNumber || b.student.rollNumber, 10);
  
    if (userProfile.role === "student") {
      wsData.push(["Subject", "Total Lectures", "Present", "Attendance %"]);
      
      attendanceData.forEach((subject) => {
        wsData.push([
          subject.name,
          subject.totalLectures,
          subject.presentCount,
          ((subject.presentCount / subject.totalLectures) * 100).toFixed(2) + "%"
        ]);
      });
  
      const totalLectures = attendanceData.reduce((sum, subject) => sum + subject.totalLectures, 0);
      const totalPresent = attendanceData.reduce((sum, subject) => sum + subject.presentCount, 0);
      wsData.push([
        "Total",
        totalLectures,
        totalPresent,
        ((totalPresent / totalLectures) * 100).toFixed(2) + "%"
      ]);
  
    } else if (userProfile.role === "faculty") {
      wsData.push(["Roll Number", "Student Name", "Total Lectures", "Present", "Attendance %"]);
      
      attendanceData[0].students.sort(sortByRollNumber).forEach((student) => {
        wsData.push([
          student.rollNumber,
          student.name,
          attendanceData[0].totalLectures,
          student.presentCount,
          ((student.presentCount / attendanceData[0].totalLectures) * 100).toFixed(2) + "%"
        ]);
      });
  
    } else if (userProfile.role === "admin" || userProfile.role === "superadmin") {
      if (viewType === "cumulative") {
        const header1 = ["Roll No", "Student Name"];
        const header2 = ["", ""];
        attendanceData.forEach((subject) => {
          header1.push(subject.name, "", "");
          header2.push(`Faculty: ${subject.facultyName}`, "", "");
        });
        header1.push("Total Attendance", "", "");
        header2.push("", "", "");
        wsData.push(header1, header2);
  
        const header3 = ["", ""];
        attendanceData.forEach(() => header3.push("Total", "Present", "%"));
        header3.push("Total", "Present", "%");
        wsData.push(header3);
  
        const allStudents = attendanceData.flatMap(subject => subject.students);
        const uniqueStudents = [...new Set(allStudents.map(s => s.rollNumber))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  
        uniqueStudents.forEach((rollNumber) => {
          const row = [rollNumber, allStudents.find(s => s.rollNumber === rollNumber).name];
          let totalPresent = 0;
          let totalLectures = 0;
  
          attendanceData.forEach((subject) => {
            const studentData = subject.students.find((s) => s.rollNumber === rollNumber);
            totalLectures += subject.totalLectures;
            const present = studentData ? studentData.presentCount : 0;
            totalPresent += present;
            row.push(
              subject.totalLectures,
              present,
              ((present / subject.totalLectures) * 100).toFixed(2) + "%"
            );
          });
  
          row.push(
            totalLectures,
            totalPresent,
            ((totalPresent / totalLectures) * 100).toFixed(2) + "%"
          );
          wsData.push(row);
        });
      } else if (viewType === "individual") {
        wsData.push(["Roll Number", "Student Name", "Total Lectures", "Present", "Attendance %"]);
        
        attendanceData[0].students.sort(sortByRollNumber).forEach((student) => {
          wsData.push([
            student.rollNumber,
            student.name,
            attendanceData[0].totalLectures,
            student.presentCount,
            ((student.presentCount / attendanceData[0].totalLectures) * 100).toFixed(2) + "%"
          ]);
        });
      }
    }
  
    const ws = XLSX.utils.aoa_to_sheet(wsData);
  
    // Set column widths
    const colWidths = wsData[0].map((_, i) => ({ wch: Math.max(...wsData.map(row => String(row[i]).length)) + 2 }));
    ws['!cols'] = colWidths;
  
    // Apply styles
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({r: R, c: C});
        if (!ws[cellRef]) continue;
        ws[cellRef].s = {
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          },
          alignment: { vertical: 'center', horizontal: 'center' },
          font: { name: 'Arial', sz: 11 }
        };
        if (R < 3 && (userProfile.role === "admin" || userProfile.role === "superadmin") && viewType === "cumulative") {
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.fill = { fgColor: { rgb: "EEEEEE" } };
        } else if (R === 0) {
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.fill = { fgColor: { rgb: "EEEEEE" } };
        }
      }
    }
  
    // Merge cells for admin/superadmin cumulative view
    if ((userProfile.role === "admin" || userProfile.role === "superadmin") && viewType === "cumulative") {
      ws['!merges'] = [];
      attendanceData.forEach((_, index) => {
        const col = index * 3 + 2;
        ws['!merges'].push(
          { s: { r: 0, c: col }, e: { r: 0, c: col + 2 } },
          { s: { r: 1, c: col }, e: { r: 1, c: col + 2 } }
        );
      });
      const totalCol = attendanceData.length * 3 + 2;
      ws['!merges'].push({ s: { r: 0, c: totalCol }, e: { r: 1, c: totalCol + 2 } });
    }
  
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
  
    // Generate a unique filename with timestamp
    const fileName = `Attendance_Report_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
  
    // Use writeFile with type 'base64' for better browser compatibility
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const blob = new Blob([s2ab(atob(wbout))], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };
  
  // Helper function to convert string to ArrayBuffer
  function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
  }
  const renderStudentAttendance = () => {
    const totalLectures = attendanceData?.reduce((sum, subject) => sum + subject.totalLectures, 0);
    const totalPresent = attendanceData?.reduce((sum, subject) => sum + subject.presentCount, 0);
  
    return (
      <Table aria-label="Student Attendance Table">
        <TableHeader>
          <TableColumn>Subject</TableColumn>
          <TableColumn>Total Lectures</TableColumn>
          <TableColumn>Present</TableColumn>
          <TableColumn>Attendance %</TableColumn>
        </TableHeader>
        <TableBody>
          {attendanceData?.map((subject) => (
            <TableRow key={subject._id}>
              <TableCell>{subject.name}</TableCell>
              <TableCell>{subject.totalLectures}</TableCell>
              <TableCell>{subject.presentCount}</TableCell>
              <TableCell>{((subject.presentCount / subject.totalLectures) * 100).toFixed(2)}%</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell><b>Total</b></TableCell>
            <TableCell><b>{totalLectures}</b></TableCell>
            <TableCell><b>{totalPresent}</b></TableCell>
            <TableCell><b>{((totalPresent / totalLectures) * 100).toFixed(2)}%</b></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };
  
  
  const renderFacultyAttendance = () => (
    <div>
      {attendanceData.map((subjectData, index) => (
        <div key={index}>
          <h3>Subject: {subjectData.name}</h3>
          <p>Faculty: {subjectData.facultyName}</p>
          <p>Batch: {subjectData.batch}</p>
          <p>Total Lectures: {subjectData.totalLectures}</p>
          <Table aria-label={`Attendance Table for ${subjectData.name}`}>
            <TableHeader>
              <TableColumn>Roll Number</TableColumn>
              <TableColumn>Student Name</TableColumn>
              <TableColumn>Present</TableColumn>
              <TableColumn>Attendance %</TableColumn>
            </TableHeader>
            <TableBody>
              {subjectData.students
                .slice()
                .sort((a, b) => parseInt(a.rollNumber, 10) - parseInt(b.rollNumber, 10))
                .map((student) => (
                  <TableRow key={student.rollNumber}>
                    <TableCell>{student.rollNumber}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.presentCount}</TableCell>
                    <TableCell>
                      {((student.presentCount / subjectData.totalLectures) * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
const renderAdminAttendance = () => {
  let sortedAttendanceData
  let subjects;
  if (viewType === "cumulative") {
  sortedAttendanceData = [...attendanceData].sort((a, b) => 
  parseInt(a.student.rollNumber) - parseInt(b.student.rollNumber)
);
 subjects = Array.from(new Set(sortedAttendanceData.flatMap(data => 
  data.subjects.map(subject => subject.subject)
)));
  }

  return (
    <div>
      {viewType === "cumulative" ? (
       <div className="overflow-x-auto">
       <table className="min-w-full border-collapse block md:table">
         <thead>
           <tr className="bg-gray-100">
             <th className="border px-4 py-2">Roll No</th>
             <th className="border px-4 py-2">Student Name</th>
             {subjects.map((subject) => (
               <th key={subject} className="border px-4 py-2" colSpan="3">
                 {subject}
                 <div className="flex justify-between mt-1">
                   <span>Total</span>
                   <span>Present</span>
                   <span>%</span>
                 </div>
               </th>
             ))}
             <th className="border px-4 py-2" colSpan="3">
               Final Attendance
               <div className="flex justify-between mt-1">
                 <span>Total</span>
                 <span>Present</span>
                 <span>%</span>
               </div>
             </th>
           </tr>
         </thead>
         <tbody>
           {sortedAttendanceData.map((studentData) => {
             let totalLectures = 0;
             let totalPresent = 0;
 
             return (
               <tr key={studentData.student._id}>
                 <td className="border px-4 py-2">{studentData.student.rollNumber}</td>
                 <td className="border px-4 py-2">{studentData.student.name}</td>
                 {subjects.map((subject) => {
                   const subjectData = studentData.subjects.find(s => s.subject === subject);
                   if (subjectData) {
                     totalLectures += subjectData.totalCount;
                     totalPresent += subjectData.presentCount;
                     return (
                       <React.Fragment key={subject}>
                         <td className="border px-4 py-2 text-center">{subjectData.totalCount}</td>
                         <td className="border px-4 py-2 text-center">{subjectData.presentCount}</td>
                         <td className="border px-4 py-2 text-center">
                           {((subjectData.presentCount / subjectData.totalCount) * 100).toFixed(2)}%
                         </td>
                       </React.Fragment>
                     );
                   } else {
                     return (
                       <React.Fragment key={subject}>
                         <td className="border px-4 py-2 text-center">-</td>
                         <td className="border px-4 py-2 text-center">-</td>
                         <td className="border px-4 py-2 text-center">-</td>
                       </React.Fragment>
                     );
                   }
                 })}
                 <td className="border px-4 py-2 text-center">{totalLectures}</td>
                 <td className="border px-4 py-2 text-center">{totalPresent}</td>
                 <td className="border px-4 py-2 text-center">
                   {totalLectures > 0 ? ((totalPresent / totalLectures) * 100).toFixed(2) : '0.00'}%
                 </td>
               </tr>
             );
           })}
         </tbody>
       </table>
     </div>
      ) : (
        <div>
    {attendanceData.map((subjectData, index) => (
      <div key={index}>
        <h3>Subject: {subjectData.name}</h3>
        <p>Faculty: {subjectData.facultyName}</p>
        <p>Batch: {subjectData.batch}</p>
        <p>Total Lectures: {subjectData.totalLectures}</p>
        <Table aria-label={`Attendance Table for ${subjectData.name}`}>
          <TableHeader>
            <TableColumn>Roll Number</TableColumn>
            <TableColumn>Student Name</TableColumn>
            <TableColumn>Present</TableColumn>
            <TableColumn>Attendance %</TableColumn>
          </TableHeader>
          <TableBody>
            {subjectData.students
              .slice()
              .sort((a, b) => parseInt(a.rollNumber, 10) - parseInt(b.rollNumber, 10))
              .map((student) => (
                <TableRow key={student.rollNumber}>
                  <TableCell>{student.rollNumber}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  <TableCell>{student.presentCount}</TableCell>
                  <TableCell>
                    {((student.presentCount / subjectData.totalLectures) * 100).toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    ))}
  </div>
)}
    </div>
  );
};  if (!userProfile) {
    return <div>Loading please wait...</div>;
  }
console.log(userProfile);
  return (
    <div className="p-4">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-bold mb-2">Attendance Report</h1>
          <p className="text-gray-600">User: {userProfile.name} ({userProfile.role})</p>
        </div>
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          {userProfile?.role === "superadmin" && (
            <Select
              placeholder="Select department"
              name="department"
              className=" w-[40%] "
              selectedKeys={[selectedDepartment]}
              onSelectionChange={(value) => handleSelectChange(value.currentKey)}
              variant="bordered"
              size="sm"
            >
              {departmentOptions.map((department) => (
                <SelectItem key={department.key} textValue={department.label}>
                  {department.label}
                </SelectItem>
              ))}
            </Select>
          )}
          {(userProfile.role === "admin" || userProfile.role === "superadmin" ) && (
            <>
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">
                    {selectedClass ? selectedClass : "Select Class"}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Class selection" onAction={(key) => setSelectedClass(key)}>
                  {classes.map((classItem) => (
                    <DropdownItem key={classItem._id}>{classItem._id}</DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
              </>
          )}
              {(userProfile.role === "admin" || userProfile.role === "superadmin" || userProfile.classes) && (
            <>
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="bordered">{viewType === "cumulative" ? "Cumulative View" : "Individual View"}</Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="View type selection"  onAction={(key) =>{
                  setAttendanceData(null)
                   setViewType(key)}}>
                  <DropdownItem key="cumulative">Cumulative View</DropdownItem>
                  <DropdownItem key="individual">Individual View</DropdownItem>
                </DropdownMenu>
              </Dropdown> 
               </>
          )}
              {(userProfile.role === "admin" || userProfile.role === "superadmin" || !userProfile.classes) && (
            <>
              {viewType === "individual" && (
                <Dropdown>
                  <DropdownTrigger>
                    <Button variant="bordered">
                      {selectedSubject ? selectedSubject : "Select Subject"}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Subject selection" onAction={(key) => setSelectedSubject(key)}>
                    {classes.find((c) => c._id === selectedClass)?.subjects.map((subject) => (
                      <DropdownItem key={subject}>{subject}</DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              )}
            </>
          )}
          {userProfile?.role === "faculty" && viewType === "individual" && (
            <Dropdown>
              <DropdownTrigger>
                <Button variant="bordered">
                  {selectedSubject || "Select Subject"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Subject selection" onAction={(key) => setSelectedSubject(key)}>
                {userProfile.subjects.map((subject) => (
                  <DropdownItem key={subject}>{subject}</DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      </div>

      <div className="mb-8 flex items-center gap-10 w-full justify-end ">
        <div className="w-full">
          <h2 className="text-xl font-semibold ">Select Date Range</h2>
          <DateRangePicker
            aria-label="Date Range"
            value={dateRange}
            onChange={setDateRange}
          // className="w-50"
          />
        </div>
        <div className="w-[10%]">  <Button variant="ghost" color="primary" size="sm" onClick={generateExcelReport} className="mb-8">
          Download Report
        </Button>
        </div>
      </div>



      {loading ? (
        <div className="flex justify-center items-center">
          <Spinner size="large" />
        </div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : attendanceData ? (
        <div>
          {userProfile.role === "student" && renderStudentAttendance()}
          {(userProfile.role === "faculty" && !userProfile?.classes) && renderFacultyAttendance()}
          {(userProfile.role === "admin" || userProfile.role === "superadmin" || userProfile.classes) && renderAdminAttendance()}
        </div>
      ) : (
        <div>No attendance data available</div>
      )}
      {!attendanceData && (
        <div className="flex justify-center mt-8">
          <Image src="/report.svg" alt="Report Image" width={800} height={500} />
        </div>
      )}
    </div>
  );
};

export default AttendanceDisplay;