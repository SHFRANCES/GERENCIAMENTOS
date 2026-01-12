import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import {
  formatCurrency,
  formatDateTime,
  formatPhone,
  getWhatsAppLink,
  statusLabels,
  statusColors,
} from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageCircle,
  FileText,
  Plus,
  Trash2,
  Clock,
  User,
  Smartphone,
  Wrench,
  DollarSign,
  CheckCircle,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const STATUS_FLOW = [
  "received",
  "analysis",
  "awaiting_approval",
  "awaiting_part",
  "in_repair",
  "completed",
];

const ServiceOrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [parts, setParts] = useState([]);
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: 1,
    unit_price: 0,
    is_part: false,
    part_id: "",
  });

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      toast.error("Erro ao carregar OS");
    } finally {
      setLoading(false);
    }
  };

  const fetchParts = async () => {
    try {
      const response = await api.get("/parts");
      setParts(response.data);
    } catch (error) {
      console.error("Error fetching parts:", error);
    }
  };

  useEffect(() => {
    fetchOrder();
    fetchParts();
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await api.put(`/orders/${id}`, { status: newStatus });
      toast.success(`Status atualizado para: ${statusLabels[newStatus]}`);
      fetchOrder();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.description || newItem.unit_price <= 0) {
      toast.error("Preencha todos os campos");
      return;
    }

    const updatedItems = [
      ...(order.items || []),
      {
        ...newItem,
        total: newItem.quantity * newItem.unit_price,
      },
    ];

    try {
      await api.put(`/orders/${id}`, { items: updatedItems });
      toast.success("Item adicionado!");
      setNewItem({ description: "", quantity: 1, unit_price: 0, is_part: false, part_id: "" });
      setItemDialogOpen(false);
      fetchOrder();
    } catch (error) {
      toast.error("Erro ao adicionar item");
    }
  };

  const handleRemoveItem = async (index) => {
    const updatedItems = order.items.filter((_, i) => i !== index);
    try {
      await api.put(`/orders/${id}`, { items: updatedItems });
      toast.success("Item removido!");
      fetchOrder();
    } catch (error) {
      toast.error("Erro ao remover item");
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/orders/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `OS_${order.order_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF gerado!");
    } catch (error) {
      toast.error("Erro ao gerar PDF");
    }
  };

  const getWhatsAppMessage = () => {
    return `Olá! Sua OS ${order.order_number} está com status: ${statusLabels[order.status]}. Acesse: ${window.location.origin}/track/${order.order_number}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">OS não encontrada</p>
        <Link to="/orders">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="order-detail">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-mono">{order.order_number}</h1>
            <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPDF} data-testid="download-pdf">
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <a
            href={getWhatsAppLink(order.client_phone || "", getWhatsAppMessage())}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="text-emerald-600" data-testid="whatsapp-btn">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Flow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Alterar Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.map((status) => (
                  <Button
                    key={status}
                    variant={order.status === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(status)}
                    disabled={updating || order.status === status}
                    data-testid={`status-${status}`}
                  >
                    {statusLabels[status]}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={updating || order.status === "cancelled"}
                  className="text-destructive"
                  data-testid="status-cancelled"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Detalhes do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Defeito Relatado</Label>
                <p className="mt-1">{order.reported_issue}</p>
              </div>
              {order.technical_diagnosis && (
                <div>
                  <Label className="text-muted-foreground">Diagnóstico Técnico</Label>
                  <p className="mt-1">{order.technical_diagnosis}</p>
                </div>
              )}
              {order.estimated_days && (
                <div>
                  <Label className="text-muted-foreground">Prazo Estimado</Label>
                  <p className="mt-1">{order.estimated_days} dias</p>
                </div>
              )}
              {order.internal_notes && (
                <div className="p-3 rounded-lg bg-muted">
                  <Label className="text-muted-foreground">Notas Internas</Label>
                  <p className="mt-1 text-sm">{order.internal_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Orçamento
              </CardTitle>
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="add-item-btn">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_part"
                        checked={newItem.is_part}
                        onChange={(e) =>
                          setNewItem({ ...newItem, is_part: e.target.checked, part_id: "" })
                        }
                      />
                      <Label htmlFor="is_part">É uma peça do estoque</Label>
                    </div>

                    {newItem.is_part ? (
                      <div className="space-y-2">
                        <Label>Peça</Label>
                        <Select
                          value={newItem.part_id}
                          onValueChange={(value) => {
                            const part = parts.find((p) => p.id === value);
                            setNewItem({
                              ...newItem,
                              part_id: value,
                              description: part?.name || "",
                              unit_price: part?.sale_price || 0,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a peça" />
                          </SelectTrigger>
                          <SelectContent>
                            {parts.map((part) => (
                              <SelectItem key={part.id} value={part.id}>
                                {part.name} - {formatCurrency(part.sale_price)} (Estoque: {part.quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input
                          value={newItem.description}
                          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          placeholder="Ex: Mão de obra, Troca de tela..."
                          data-testid="item-description"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          value={newItem.quantity}
                          onChange={(e) =>
                            setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
                          }
                          min="1"
                          data-testid="item-quantity"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Unitário</Label>
                        <Input
                          type="number"
                          value={newItem.unit_price}
                          onChange={(e) =>
                            setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })
                          }
                          min="0"
                          step="0.01"
                          data-testid="item-price"
                        />
                      </div>
                    </div>

                    <Button onClick={handleAddItem} className="w-full" data-testid="confirm-item">
                      Adicionar Item
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {order.items?.length > 0 ? (
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(item.total)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Separator className="my-4" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">Nenhum item no orçamento</p>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.history?.map((entry, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{statusLabels[entry.status]}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(entry.timestamp)} - {entry.user}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{order.client_name}</p>
              <Link to={`/clients/${order.client_id}`} className="text-sm text-primary hover:underline">
                Ver perfil
              </Link>
            </CardContent>
          </Card>

          {/* Device Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Aparelho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{order.device_info}</p>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Acompanhamento
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <QRCodeSVG
                value={`${window.location.origin}/track/${order.order_number}`}
                size={150}
                className="mb-4"
              />
              <p className="text-xs text-muted-foreground text-center">
                Escaneie para acompanhar o status
              </p>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardContent className="pt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{formatDateTime(order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Atualizado</span>
                <span>{formatDateTime(order.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Responsável</span>
                <span>{order.created_by}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ServiceOrderDetail;
