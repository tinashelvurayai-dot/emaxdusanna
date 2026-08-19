import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { uncoveredCourses, courseCatalog, courseCategories } from "@/lib/course-catalog";

/**
 * Catalogue entries that are hidden from learners because no learning-content
 * file exists for them yet. Adding the data file + registry entry publishes the
 * course automatically.
 */
export function HiddenCoursesTab() {
  return (
    <div className="glass-card-light p-4 sm:p-6 overflow-x-auto">
      <h2 className="text-lg font-bold text-blue-900 mb-1">Hidden courses (no content yet)</h2>
      <p className="text-sm text-blue-600 mb-4">
        {uncoveredCourses.length} of {uncoveredCourses.length + courseCatalog.length} courses have no learning
        content file, so they are hidden from the public catalogue. Add
        <code className="mx-1 text-xs">src/lib/lib/courses/lib/courses/diplomas/&lt;id&gt;-course-data.ts</code>
        and register it in <code className="text-xs">src/lib/generated/course-content-registry.ts</code> - the
        course then appears in the catalogue automatically.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Course ID</TableHead>
            <TableHead>Certificate title</TableHead>
            <TableHead>Diploma title</TableHead>
            <TableHead>Category</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uncoveredCourses.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.id}</TableCell>
              <TableCell className="font-semibold text-blue-900">{c.certificateTitle}</TableCell>
              <TableCell>{c.diplomaTitle}</TableCell>
              <TableCell>{courseCategories.find((k) => k.id === c.category)?.name ?? c.category}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
