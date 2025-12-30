import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainingRun } from '@/api/entities';
import { Project } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  BarChart3,
  ChevronRight,
  Filter,
  Search,
  ArrowUpDown,
  X,
  Rocket,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  Brain
} from 'lucide-react';
import { createPageUrl } from '@/utils';

const statusConfig = {
    running: { icon: <Rocket className="w-4 h-4 text-blue-500" />, color: "bg-blue-100 text-blue-800", label: "Running" },
    queued: { icon: <Clock className="w-4 h-4 text-amber-500" />, color: "bg-amber-100 text-amber-800", label: "Queued" },
    canceling: { icon: <Clock className="w-4 h-4 text-amber-500" />, color: "bg-amber-100 text-amber-800", label: "Canceling" },
    completed: { icon: <CheckCircle className="w-4 h-4 text-blue-500" />, color: "bg-blue-100 text-blue-800", label: "Completed" },
    failed: { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, color: "bg-red-100 text-red-800", label: "Failed" },
    stopped: { icon: <XCircle className="w-4 h-4 text-gray-500" />, color: "bg-gray-100 text-gray-800", label: "Stopped" },
    canceled: { icon: <XCircle className="w-4 h-4 text-gray-500" />, color: "bg-gray-100 text-gray-800", label: "Canceled" },
    configuring: { icon: <Settings className="w-4 h-4 text-gray-500" />, color: "bg-gray-100 text-gray-800", label: "Configuring" },
};

export default function ResultsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [runsData, projectsData] = await Promise.all([
          TrainingRun.list('-created_date'),
          Project.list()
        ]);
        setRuns(runsData);
        setProjects(projectsData);
      } catch (error) {
        console.error("Error loading results data:", error);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedRuns = useMemo(() => {
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    let filtered = runs.map(run => ({
      ...run,
      projectName: projectMap.get(run.project_id) || 'Unknown Project'
    }));

    if (searchQuery) {
      filtered = filtered.filter(run => 
        run.run_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.projectName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (projectFilter !== 'all') {
      filtered = filtered.filter(run => run.project_id === projectFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(run => run.status === statusFilter);
    }

    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [runs, projects, searchQuery, projectFilter, statusFilter, sortConfig]);

  const clearFilters = () => {
    setSearchQuery("");
    setProjectFilter("all");
    setStatusFilter("all");
    setSortConfig({ key: 'created_date', direction: 'desc' });
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              Results Dashboard
            </h1>
            <p className="text-gray-600 text-lg">
              Track, review, and compare all your model training results.
            </p>
          </div>
        </div>

        <Card className="glass-effect border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by run or project name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto">
                <X className="w-4 h-4 mr-2" /> Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-effect border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Training & Inference Runs</CardTitle>
            <CardDescription>
              Showing {processedRuns.length} of {runs.length} total runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center p-12">
                 <Brain className="w-12 h-12 mx-auto mb-4 animate-pulse text-blue-500" />
                 <p className="text-gray-600">Loading results...</p>
              </div>
            ) : processedRuns.length === 0 ? (
              <div className="text-center p-12">
                 <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                 <h3 className="text-xl font-semibold text-gray-900 mb-2">No Results Found</h3>
                 <p className="text-gray-600">
                    {runs.length === 0
                      ? "You haven't run any training jobs yet."
                      : "Try adjusting your search or filters."
                    }
                 </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead onClick={() => handleSort('run_name')} className="cursor-pointer">Run <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                      <TableHead onClick={() => handleSort('projectName')} className="cursor-pointer">Project <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead onClick={() => handleSort('created_date')} className="cursor-pointer">Date <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRuns.map(run => (
                      <TableRow key={run.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{run.run_name}</TableCell>
                        <TableCell>{run.projectName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusConfig[run.status]?.color || ''} border`}>
                            {statusConfig[run.status]?.icon}
                            <span className="ml-1.5">{statusConfig[run.status]?.label || 'Unknown'}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600">{run.created_by.split('@')[0]}</TableCell>
                        <TableCell className="text-gray-600">{new Date(run.created_date).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`TrainingStatus?runId=${run.id}`))}>
                            View Details <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
