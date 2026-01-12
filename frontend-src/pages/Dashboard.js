import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency, statusLabels, statusColors } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  ClipboardList,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  Wrench,
  Package,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280"];

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardRes, ordersRes] = await Promise.all([
          api.get("/dashboard"),
          api.get("/orders?limit=5"),
        ]);
        setStats(dashboardRes.data);
        setRecentOrders(ordersRes.data.slice(0, 5));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const orderStatusData = stats?.orders_by_status
    ? Object.entries(stats.orders_by_status)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          name: statusLabels[status] || status,
          value: count,
        }))
    : [];

  const revenueData = [
    { name: "Hoje", value: stats?.today_revenue || 0 },
    { name: "Semana", value: stats?.week_revenue || 0 },
    { name: "Mês", value: stats?.month_revenue || 0 },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu negócio</p>
        </div>
        <Link to="/orders">
          <Button data-testid="new-order-btn">
            <Plus className="mr-2 h-4 w-4" />
            Nova OS
          </Button>
        </Link>
      </div>

      {/* Alerts */}
      {stats?.alerts && stats.alerts.length > 0 && (
        <div className="space-y-2">
          {stats.alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-4 rounded-lg border ${
                alert.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                  : alert.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300"
                  : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
              }`}
              data-testid={`alert-${alert.type}`}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow" data-testid="stat-received">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebidas</CardTitle>
            <ClipboardList className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.orders_by_status?.received || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando análise</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow" data-testid="stat-in-progress">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Reparo</CardTitle>
            <Wrench className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.orders_by_status?.in_repair || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Em andamento</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow" data-testid="stat-completed">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.orders_by_status?.completed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Prontas para retirada</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow" data-testid="stat-revenue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Mês</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats?.month_revenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Hoje: {formatCurrency(stats?.today_revenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `R$${value}`} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              OS por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {orderStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {orderStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhuma OS cadastrada
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders & Top Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Últimas Ordens
            </CardTitle>
            <Link to="/orders">
              <Button variant="ghost" size="sm">
                Ver todas <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                    data-testid={`recent-order-${order.order_number}`}
                  >
                    <div>
                      <p className="font-mono text-sm font-medium">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">{order.client_name}</p>
                    </div>
                    <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                  </Link>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhuma OS cadastrada</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Serviços Mais Realizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.top_services && stats.top_services.length > 0 ? (
                stats.top_services.map((service, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{service.name}</span>
                    <Badge variant="secondary">{service.count}x</Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum serviço registrado</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
