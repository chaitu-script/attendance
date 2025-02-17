"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button, Checkbox, CheckboxGroup } from "@nextui-org/react";
import { Table, TableHeader, Input, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";
import axios from 'axios';
import { DatePicker } from "@nextui-org/date-picker";
import Image from "next/image";

export default function App() {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [sessions] = useState([1, 2, 3, 4, 5, 6, 7]);
  const [profile, setProfile] = useState(null);
  const [subjectDetails, setSubjectDetails] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceRecord, setAttendanceRecord] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isTableVisible, setIsTableVisible] = useState(false);
  const [pointsDiscussed, setPointsDiscussed] = useState([]);
  const [tgSessions, setTgSessions] = useState([]);
  useEffect(() => {
    const storedProfile = sessionStorage.getItem('userProfile');
    if (storedProfile) {
      const parsedProfile = JSON.parse(storedProfile);
      setProfile(parsedProfile);
      if (parsedProfile.subjects.length === 1) {
        setSelectedSubject(parsedProfile.subjects[0]);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchSubjectData();
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedSubject && selectedDate && selectedSession) {
      if (subjectDetails && (subjectDetails.subType === 'practical' || subjectDetails.subType === 'tg')) {
        if (selectedBatch) {
          fetchSubjectAttendance();
        }
      } else {
        fetchSubjectAttendance();
      }
    }
  }, [selectedSubject, selectedDate, selectedSession, selectedBatch, subjectDetails]);

  const fetchSubjectData = async () => {
    try {
      const response = await axios.get(`/api/utils/subjectBatch?subjectId=${selectedSubject}`);
      const { subject } = response.data;

      console.log(response.data);


      setSubjectDetails(subject);
      if (subject.subType === 'practical' || subject.subType === 'tg') {
       
        setBatches(subject.batch);
        if (subject.subType === 'tg') {
          setTgSessions(subject.tgSessions || []);
        }
      } else {
        setBatches([]);
        setSelectedBatch(null);
      }
    } catch (error) {
      console.error('Error fetching subject data:', error);
    }
  };


  const handleTakeAttendance = () => {
    setIsTableVisible(true);
  };
  const fetchSubjectAttendance = async () => {
    try {
      const response = await axios.get(`/api/update`, {
        params: {
          subjectId: selectedSubject,
          date: selectedDate.toISOString().split("T")[0],
          session: selectedSession,
          batchId: subjectDetails.subType === 'theory' ? undefined : selectedBatch
        }
      });
      const { students, attendanceRecord } = response.data;

      console.log(response.data);

      students.sort((a, b) => parseInt(a.rollNumber) - parseInt(b.rollNumber));

      setStudents(students);
      setAttendanceRecord(attendanceRecord);
      if (attendanceRecord) {
        setSelectedKeys(new Set(attendanceRecord.records.map(r => r.status === "present" && r.student)));
        setSelectedContentIds(attendanceRecord.contents || []);
        if (subjectDetails.subType === 'tg') {
          setPointsDiscussed(attendanceRecord.pointsDiscussed || []);
        }
      } else {
        setSelectedKeys(new Set());
        setSelectedContentIds([]);
        setPointsDiscussed([]);
      }
    } catch (error) {
      console.error('Error fetching subject attendance:', error);
    }
  };

  const updateAttendance = async () => {
    if (!selectedSubject || !selectedDate || !selectedSession) {
      alert("Please select subject, date, and session");
      return;
    }

    let presentStudentIds = [];
    if (selectedKeys instanceof Set) {
      if (selectedKeys.has("all")) {
        presentStudentIds = students.map(student => student._id);
      } else {
        presentStudentIds = Array.from(selectedKeys);
      }
    } else {
      presentStudentIds = selectedKeys.includes("all")
        ? students.map(student => student._id)
        : selectedKeys;
    }
    const attendanceData = students.map(student => ({
      student: student._id,
      status: presentStudentIds.includes(student._id) ? 'present' : 'absent'
    }));

    try {
      const requestData = {
        subject: selectedSubject,
        date: selectedDate.toISOString().split("T")[0],
        session: selectedSession,
        batchId: selectedBatch,
        attendanceRecords: attendanceData,
      };

      if (subjectDetails.subType === 'tg') {
        requestData.pointsDiscussed = pointsDiscussed;
      } else {
        requestData.contents = selectedContentIds;
      }

      const response = await axios.put(`/api/attendance`, requestData);

      alert("Attendance updated successfully");
      fetchSubjectAttendance();
    } catch (error) {
      console.error('Failed to update attendance:', error);
      alert("Failed to update attendance");
    } finally {
      setSelectedBatch(null);
      setIsTableVisible(false);
      setSelectedKeys(new Set());
      setSelectedContentIds([]);
      setSelectedSession([]);
      setSelectedSubject("")
      setPointsDiscussed([]);
    }
  };

  const TGSessionContent = useMemo(() => {
    if (!subjectDetails || subjectDetails.subType !== 'tg') return null;

    return (
      <div>
        <h2>TG Session Details</h2>
        <div className="flex flex-col gap-2">
          {pointsDiscussed.map((point, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={point}
                variant='bordered'
                onChange={(e) => {
                  const newPoints = [...pointsDiscussed];
                  newPoints[index] = e.target.value;
                  setPointsDiscussed(newPoints);
                }}
                className="flex-grow"
                placeholder={`Point ${index + 1}`}
              />
              <Button variant='bordered' color='primary' onClick={() => {
                const newPoints = pointsDiscussed.filter((_, i) => i !== index);
                setPointsDiscussed(newPoints);

              }}>Remove</Button>
            </div>
          ))}
          <Button variant="shadow" className="max-w-1/2 mx-auto" color="primary" onClick={() => setPointsDiscussed([...pointsDiscussed, ''])}>
            Add Point
          </Button>
        </div>
      </div>
    );
  }, [subjectDetails, pointsDiscussed]);
  const convertToDate = (customDate) => {
    const { year, month, day } = customDate;
    return new Date(year, month - 1, day + 1);
  };

  const TGSessionsHistory = ({ sessions }) => {
    return (
      <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">TG Sessions History</h2>
        {sessions.map((session, index) => (
          <div key={index} className="mb-4 p-4 border rounded">
            <h3 className="font-semibold">Date: {new Date(session.date).toLocaleDateString()}</h3>
            <ul className="list-disc pl-5">
              {session.pointsDiscussed.map((point, pointIndex) => (
                <li key={pointIndex}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };
  const CourseContentTable = useMemo(() => {
    if (!subjectDetails || !subjectDetails.content) return null;

    return (
      <Table aria-label="Course Content Table" className="max-h-[75vh]">
        <TableHeader>
          <TableColumn>Select</TableColumn>
          <TableColumn>Title</TableColumn>
          <TableColumn>Description</TableColumn>
          <TableColumn>Proposed Date</TableColumn>
          <TableColumn>Completed Date</TableColumn>
          <TableColumn>References</TableColumn>
          <TableColumn>CO</TableColumn>
          <TableColumn>PO:</TableColumn>
          <TableColumn>Status</TableColumn>
        </TableHeader>
        <TableBody>
          {subjectDetails.content.map((content) => (
            <TableRow key={content._id}>
              <TableCell>
                <Checkbox
                  isSelected={selectedContentIds.includes(content._id)}
                  onChange={() => {
                    setSelectedContentIds(prev =>
                      prev.includes(content._id)
                        ? prev.filter(id => id !== content._id)
                        : [...prev, content._id]
                    );
                  }}
                  isDisabled={content.status === 'covered'}
                />
              </TableCell>
              <TableCell>{content.title}</TableCell>
              <TableCell>{content.description}</TableCell>
              <TableCell>{content.proposedDate}</TableCell>
              <TableCell>{content.completedDate}</TableCell>
              <TableCell>{content.references} </TableCell>
              <TableCell>{content.courseOutcomes} </TableCell>
              <TableCell>{content.programOutcomes} </TableCell>
              <TableCell>{content.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [subjectDetails, selectedContentIds]);

  const StudentListTable = useMemo(() => {
    return (
      <Table
        aria-label="Attendance Table"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        className="max-h-[75vh]"
        onSelectionChange={setSelectedKeys}
      >
        <TableHeader>
          <TableColumn>Roll Number</TableColumn>
          <TableColumn>Name</TableColumn>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student._id}>
              <TableCell>{student.rollNumber}</TableCell>
              <TableCell>{student.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [students, selectedKeys]);
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-4">
        {profile && profile.subjects.length > 1 && (
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered" className="capitalize">
                {selectedSubject ? selectedSubject : "Select Subject"}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Subject selection"
              variant="flat"
              disallowEmptySelection
              selectionMode="single"
              selectedKeys={selectedSubject ? new Set([selectedSubject]) : new Set()}
              onSelectionChange={(keys) => setSelectedSubject(Array.from(keys)[0])}
            >
              {profile.subjects.map((subject) => (
                <DropdownItem key={subject}>{subject}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        )}
        <div className="max-w-[60%]">
          <DatePicker
            selected={selectedDate}
            onChange={date => setSelectedDate(convertToDate(date))}
            dateFormat="yyyy-MM-dd"
          />
        </div>
        <div className="max-w-[60%]">
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered" className="capitalize">
                {selectedSession ? `Session ${selectedSession}` : "Select Session"}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Session selection"
              variant="flat"
              disallowEmptySelection
              selectionMode="single"
              selectedKeys={selectedSession ? new Set([selectedSession.toString()]) : new Set()}
              onSelectionChange={(keys) => setSelectedSession(parseInt(Array.from(keys)[0]))}
            >
              {sessions.map((session) => (
                <DropdownItem key={session.toString()}>Session {session}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>
        {subjectDetails?.subType !== "theory" &&
          <div className="max-w-[60%]">
            <Dropdown>
              <DropdownTrigger>
                <Button variant="bordered" className="capitalize">
                  {selectedBatch ? `Batch ${selectedBatch}` : "Select Batch"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Batch selection"
                variant="flat"
                disallowEmptySelection
                selectionMode="single"
                selectedKeys={selectedBatch ? new Set([selectedBatch]) : new Set()}
                onSelectionChange={(keys) => setSelectedBatch(Array.from(keys)[0])}
              >
                {batches.map((batch) => (
                  <DropdownItem key={batch}>{batch}</DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          </div>
        }
        <Button color="primary" variant="shadow" className="mx-4" onClick={handleTakeAttendance}>
          Take Attendance
        </Button>
      </div>
      {selectedSubject !== "Subject" && subjectDetails && isTableVisible && (
        <div className="flex gap-4 mb-4">

          <div className="w-1/2">
            <h2> {subjectDetails.subType === 'tg' ? "Points Discussion" : "Course Content"}</h2>
            {subjectDetails.subType === 'tg' ? TGSessionContent : CourseContentTable}
            {subjectDetails.subType === 'tg' && <TGSessionsHistory sessions={tgSessions} />}
          </div>
          <div className="w-1/2">
            <h2>Students List</h2>
            {StudentListTable}
          </div>
        </div>
      )}
      {isTableVisible && selectedSubject && subjectDetails && (
        <Button color="primary" className="max-w-[50%] mx-auto" variant="shadow" onClick={updateAttendance}>
          Update Attendance
        </Button>
      )}
      {!isTableVisible && (
        <div className="mt-8 flex flex-col items-center gap-3 ">
          <Image
            alt="No data found"
            src="/update.svg"
            width={500}
            height={500}
            className="object-contain"
          />
          <p className="text-2xl">No Students Found</p>

        </div>
      )}
    </div>
  );
}
