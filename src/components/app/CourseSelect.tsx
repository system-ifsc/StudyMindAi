import { COURSES, findCourse } from "@/lib/core/courses";
import { NativeSelect } from "@/components/app/ui";

export function CourseSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      id={id}
      value={findCourse(value)?.name ?? ""}
      onChange={(event) => onChange(event.target.value)}
      required
    >
      <option value="" disabled>
        Selecione seu curso
      </option>
      {COURSES.map((course) => (
        <option key={course.name} value={course.name}>
          {course.name}
        </option>
      ))}
    </NativeSelect>
  );
}
