import { useState, useEffect } from "react";
import api from "../lib/api";
import { deviceTypeLabels } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Smartphone, Edit, Trash2 } from "lucide-react";

const DeviceForm = ({ device, clients, onSuccess, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_id: device?.client_id || "",
    type: device?.type || "cellphone",
    brand: device?.brand || "",
    model: device?.model || "",
    serial_imei: device?.serial_imei || "",
    condition_notes: device?.condition_notes || "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (device) {
        await api.put(`/devices/${device.id}`, formData);
        toast.success("Aparelho atualizado!");
      } else {
        await api.post("/devices", formData);
        toast.success("Aparelho cadastrado!");
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar aparelho");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client_id">Cliente *</Label>
        <Select
          value={formData.client_id}
          onValueChange={(value) => setFormData({ ...formData, client_id: value })}
          required
        >
          <SelectTrigger data-testid="device-client">
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger data-testid="device-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(deviceTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Marca *</Label>
          <Input
            id="brand"
            data-testid="device-brand"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="model">Modelo *</Label>
          <Input
            id="model"
            data-testid="device-model"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="serial_imei">IMEI / Número de Série</Label>
          <Input
            id="serial_imei"
            data-testid="device-serial"
            value={formData.serial_imei}
            onChange={(e) => setFormData({ ...formData, serial_imei: e.target.value })}
            className="font-mono"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="condition_notes">Estado do Aparelho</Label>
        <Textarea
          id="condition_notes"
          data-testid="device-condition"
          value={formData.condition_notes}
          onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })}
          placeholder="Descreva o estado do aparelho na entrada..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} data-testid="device-submit">
          {loading ? "Salvando..." : device ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const fetchData = async () => {
    try {
      const [devicesRes, clientsRes] = await Promise.all([
        api.get("/devices"),
        api.get("/clients"),
      ]);
      setDevices(devicesRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredDevices = devices.filter((device) => {
    const searchLower = search.toLowerCase();
    return (
      device.brand.toLowerCase().includes(searchLower) ||
      device.model.toLowerCase().includes(searchLower) ||
      (device.serial_imei && device.serial_imei.toLowerCase().includes(searchLower))
    );
  });

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este aparelho?")) return;

    try {
      await api.delete(`/devices/${id}`);
      toast.success("Aparelho removido!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao remover aparelho");
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "-";
  };

  return (
    <div className="space-y-6" data-testid="devices-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Aparelhos</h1>
          <p className="text-muted-foreground">Gerencie os aparelhos cadastrados</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedDevice(null)} data-testid="new-device-btn">
              <Plus className="mr-2 h-4 w-4" />
              Novo Aparelho
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedDevice ? "Editar Aparelho" : "Novo Aparelho"}</DialogTitle>
            </DialogHeader>
            <DeviceForm
              device={selectedDevice}
              clients={clients}
              onSuccess={fetchData}
              onClose={() => {
                setSelectedDevice(null);
                setDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por marca, modelo ou IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="device-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Nenhum aparelho encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aparelho</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">IMEI/Serial</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <TableRow key={device.id} data-testid={`device-row-${device.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {device.brand} {device.model}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{deviceTypeLabels[device.type]}</Badge>
                      </TableCell>
                      <TableCell>{getClientName(device.client_id)}</TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-sm">
                        {device.serial_imei || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedDevice(device);
                              setDialogOpen(true);
                            }}
                            data-testid={`edit-device-${device.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(device.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-device-${device.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

export default Devices;
