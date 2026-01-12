import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency, formatDate, statusLabels, statusColors, deviceTypeLabels } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Eye, Filter, ClipboardList } from "lucide-react";

const NewOrderForm = ({ onSuccess, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [devices, setDevices] = useState([]);
  const [formData, setFormData] = useState({
    client_id: "",
    device_id: "",
    reported_issue: "",
    technical_diagnosis: "",
    estimated_days: "",
    internal_notes: "",
  });

  useEffect(() => {
    const fetchClients = async () => {
      const res = await api.get("/clients");
      setClients(res.data);
    };
    fetchClients();
  }, []);

  useEffect(() => {
    if (formData.client_id) {
      const fetchDevices = async () => {
        const res = await api.get(`/devices?client_id=${formData.client_id}`);
        setDevices(res.data);
      };
      fetchDevices();
    } else {
      setDevices([]);
    }
  }, [formData.client_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        estimated_days: formData.estimated_days ? parseInt(formData.estimated_days) : null,
        items: [],
      };
      const response = await api.post("/orders", payload);
      toast.success(`OS ${response.data.order_number} criada!`);
      onSuccess(response.data.id);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar OS");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Select
          value={formData.client_id}
          onValueChange={(value) => setFormData({ ...formData, client_id: value, device_id: "" })}
        >
          <SelectTrigger data-testid="order-client">
            <SelectValue placeholder="Selecione o cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Aparelho *</Label>
        <Select
          value={formData.device_id}
          onValueChange={(value) => setFormData({ ...formData, device_id: value })}
          disabled={!formData.client_id}
        >
          <SelectTrigger data-testid="order-device">
            <SelectValue placeholder={formData.client_id ? "Selecione o aparelho" : "Selecione um cliente primeiro"} />
          </SelectTrigger>
          <SelectContent>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.brand} {device.model} ({deviceTypeLabels[device.type]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Defeito Relatado *</Label>
        <Textarea
          data-testid="order-issue"
          value={formData.reported_issue}
          onChange={(e) => setFormData({ ...formData, reported_issue: e.target.value })}
          placeholder="Descreva o problema relatado pelo cliente..."
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Diagnóstico Técnico</Label>
        <Textarea
          data-testid="order-diagnosis"
          value={formData.technical_diagnosis}
          onChange={(e) => setFormData({ ...formData, technical_diagnosis: e.target.value })}
          placeholder="Diagnóstico inicial..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Prazo Estimado (dias)</Label>
        <Input
          type="number"
          data-testid="order-days"
          value={formData.estimated_days}
          onChange={(e) => setFormData({ ...formData, estimated_days: e.target.value })}
          min="1"
        />
      </div>

      <div className="space-y-2">
        <Label>Observações Internas</Label>
        <Textarea
          data-testid="order-notes"
          value={formData.internal_notes}
          onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
          placeholder="Notas visíveis apenas para a equipe..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} data-testid="order-submit">
          {loading ? "Criando..." : "Criar OS"}
        </Button>
      </div>
    </form>
  );
};

const ServiceOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      let url = "/orders";
      const params = [];
      if (search) params.push(`search=${search}`);
      if (statusFilter !== "all") params.push(`status=${statusFilter}`);
      if (params.length > 0) url += `?${params.join("&")}`;

      const response = await api.get(url);
      setOrders(response.data);
    } catch (error) {
      toast.error("Erro ao carregar ordens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter]);

  const handleOrderCreated = (orderId) => {
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
          <p className="text-muted-foreground">Gerencie suas OS</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-order-btn">
              <Plus className="mr-2 h-4 w-4" />
              Nova OS
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Ordem de Serviço</DialogTitle>
            </DialogHeader>
            <NewOrderForm onSuccess={handleOrderCreated} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="order-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]" data-testid="status-filter">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Nenhuma OS encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Aparelho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Data</TableHead>
                    <TableHead className="hidden lg:table-cell">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                      <TableCell>
                        <span className="font-mono font-medium">{order.order_number}</span>
                      </TableCell>
                      <TableCell>{order.client_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{order.device_info}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status]}>
                          {statusLabels[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDate(order.created_at)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatCurrency(order.total)}</TableCell>
                      <TableCell className="text-right">
                        <Link to={`/orders/${order.id}`}>
                          <Button variant="ghost" size="icon" data-testid={`view-order-${order.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
  );
};

export default ServiceOrders;
