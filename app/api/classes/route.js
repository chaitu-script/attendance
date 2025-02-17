import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/connectDb";
import Classes from "@/models/className";
import Student from "@/models/student";
import Faculty from "@/models/faculty";

export async function POST(req) {
    try {
        await connectMongoDB();
        const data = await req.json();
        const { _id, passOutYear, classCoordinator, department, year, students, batches } = data;

        const newClass = new Classes({
            _id,
            students,
            teacher: classCoordinator,
            passOutYear,
            department,
            year,
            batches
        });
        await newClass.save();

        // Update the students to reference the new class
        await Student.updateMany(
            { _id: { $in: students } },
            { $set: { class: newClass._id } }
        );

        await Faculty.findByIdAndUpdate(
            classCoordinator,
            { $push: { coordinatedClasses: newClass._id } },
            { new: true }
        );


        // Update the faculty to reference the new class
        await Faculty.updateOne(
            { _id: classCoordinator },
            { $set: { classes: newClass._id } }
        );


        console.log("Class Registered Successfully", newClass);
        return NextResponse.json({ message: "Class Registered Successfully", class: newClass }, { status: 201 });
    } catch (error) {
        console.error("Error creating class:", error);
        return NextResponse.json({ error: "Failed to Register" }, { status: 500 });
    }
}

export async function PUT(req) {
    try {
        await connectMongoDB();
        const { searchParams } = new URL(req.url);
        const _id = searchParams.get("_id");

        const data = await req.json();
        const { classCoordinator, passOutYear, department, year, students, batches } = data;
        const existingClass = await Classes.findById(_id);

        if (!existingClass) {
            return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        const previousStudentIds = existingClass.students;
        const previousClassCoordinator = existingClass.teacher;

        existingClass.teacher = classCoordinator;
        existingClass.passOutYear = passOutYear;
        existingClass.department = department;
        existingClass.year = year;
        existingClass.students = students;
        existingClass.batches = batches;

        // Update students to reference the new class
        await Student.updateMany(
            { _id: { $in: previousStudentIds } },
            { $unset: { class: "" } }
        );

        await Student.updateMany(
            { _id: { $in: students } },
            { $set: { class: existingClass._id } }
        );

        // Update the previous faculty to remove the class reference
        if (previousClassCoordinator && previousClassCoordinator !== classCoordinator) {
            await Faculty.updateOne(
                { _id: previousClassCoordinator },
                { $unset: { classes: "" } }
            );
        }

        // Update the new faculty to reference the class
        await Faculty.updateOne(
            { _id: classCoordinator },
            { $set: { classes: existingClass._id } }
        );

        await existingClass.save();

        console.log("Class Updated Successfully", existingClass);
        return NextResponse.json({ message: "Class Updated Successfully", class: existingClass }, { status: 200 });
    } catch (error) {
        console.error("Error updating class:", error);
        return NextResponse.json({ error: "Failed to Update" }, { status: 500 });
    }
}

export async function GET(req) {
    try {
        await connectMongoDB();
        const { searchParams } = new URL(req.url);
        const _id = searchParams.get("_id");
        const department = searchParams.get("department");
        const passOutYear = searchParams.get("passOutYear");

        let filter = {};
        if (_id) filter._id = _id;
        if (department) filter.department = department;
        if (passOutYear) filter.passOutYear = passOutYear;

        console.log("Filter criteria:", filter);

        const classes = await Classes.find(filter)
            .populate('teacher', 'name')
            .populate('students', '_id rollNumber name')
            .lean();

        if (classes.length === 0) {
            console.log("No classes found for criteria:", filter);
            return NextResponse.json({ status: 404 });
        }
        return NextResponse.json(classes, { status: 200 });
    } catch (error) {
        console.error("Error fetching classes:", error);
        return NextResponse.json({ error: "Failed to Fetch Classes" }, { status: 500 });
    }
}

export async function DELETE(req) {

    try {
        await connectMongoDB();
        const { searchParams } = new URL(req.url);
        const _id = searchParams.get("_id");

        const deletedClass = await Classes.findByIdAndDelete(_id);

        if (!deletedClass) {
            return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }
        await Student.updateMany(
            { _id: { $in: deletedClass.students } },
            { $unset: { class: "" } }
        );
        console.log("Class Deleted Successfully", deletedClass);
        return NextResponse.json({ message: "Class Deleted Successfully" }, { status: 200 });
    } catch (error) {
        console.error("Error deleting class:", error);
        return NextResponse.json({ error: "Failed to Delete" }, { status: 500 });
    }
}
